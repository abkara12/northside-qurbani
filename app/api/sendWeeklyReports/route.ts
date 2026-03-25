import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Firebase environment variables are not set.");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

export async function GET() {
  try {
    const usersSnapshot = await db.collection("users").get();
    const reports: any[] = [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      const logsSnapshot = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("logs")
        .orderBy("createdAt", "desc")
        .get();

      const recentLogs = logsSnapshot.docs.filter((logDoc) => {
        const logData = logDoc.data();
        const createdAt = logData.createdAt;
        if (!createdAt) return false;
        const logDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        return logDate >= sevenDaysAgo;
      });

      let monthLabel = "";
      if (recentLogs.length > 0) {
        const firstLog = recentLogs[0].data();
        const d = firstLog.createdAt?.toDate ? firstLog.createdAt.toDate() : new Date();
        monthLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }

      let reportText = `السلام عليكم ورحمة الله وبركاته

📖 *Weekly Hifdh Report*
👤 *Student*: ${userData.username}
👨‍🏫 *Ustad*: Moulana Shaheed Bhabha
🗓️ *Month*: ${monthLabel}

`;

      if (recentLogs.length > 0) {
        recentLogs.forEach((logDoc, index) => {
          const logData = logDoc.data();
          const dateObj = logData.createdAt?.toDate ? logData.createdAt.toDate() : new Date();

          const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
          const dateFormatted = dateObj.toLocaleDateString("en-US", { day: "numeric", month: "short" });

          reportText += `*${dayName} ${dateFormatted}*\n\n`;

          // Sabak
          reportText += `*Sabak*: ${logData.sabak ?? "-"} | ${logData.sabakReadQuality ?? "-"}\n`;
          if (logData.sabakReadNotes) reportText += `📝 Note: ${logData.sabakReadNotes}\n\n`;

          // Sabak Dhor
          reportText += `*Sabak Dhor*: ${logData.sabakDhor ?? "-"} | ${logData.sabakDhorReadQuality ?? "-"}\n`;
          if (logData.sabakDhorReadNotes) reportText += `📝 Note: ${logData.sabakDhorReadNotes}\n\n`;

          // Dhor
          reportText += `*Dhor*: ${logData.dhor ?? "-"} | ${logData.dhorReadQuality ?? "-"}\n`;
          if (logData.dhorReadNotes) reportText += `📝 Note: ${logData.dhorReadNotes}\n\n`;

          // Mistakes
          reportText += `❌ *Mistakes*: Sabak Dhor ${logData.sabakDhorMistakes ?? "0"} | Dhor ${logData.dhorMistakes ?? "0"}\n`;

          if (index !== recentLogs.length - 1) reportText += `────────────────\n\n`;
        });

        const latestLog = recentLogs[0].data();
        const goalStatus = latestLog.weeklyGoalCompleted ? "✅ Completed" : "⏳ In Progress";

        reportText += `\n🎯 *Weekly Goal*: ${latestLog.weeklyGoal ?? "-"}\n`;
        reportText += `📊 *Goal Status*: ${goalStatus}\n`;
        reportText += `⏱️ Duration: ${latestLog.weeklyGoalDurationDays ?? "-"} days\n\n`;

        reportText += `────────────────\n\n*Powered by The Hifdh Journal*`;
      } else {
        reportText += `No logs recorded for the last 7 days.\n\n────────────────\n\n*Powered by The Hifdh Journal*`;
      }

      reports.push({
        student: userData.username,
        parentPhone: userData.parentPhone,
        report: reportText.trim(),
      });
    }

    // Send back HTML so you can copy reports easily
    let html = `<html><head><meta charset="UTF-8"><title>Weekly Hifdh Reports</title></head><body>`;
    reports.forEach((r) => {
      html += `<div style="border:1px solid #ccc;padding:15px;margin:15px;border-radius:10px;">
        <h2 style="font-family:sans-serif;">${r.student}</h2>
        <pre style="white-space:pre-wrap;font-family:monospace;">${r.report}</pre>
        <button onclick="navigator.clipboard.writeText(\`${r.report.replace(/`/g, '\\`')}\`)">Copy to Clipboard</button>
      </div>`;
    });
    html += `</body></html>`;

    return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}