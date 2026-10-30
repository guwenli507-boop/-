
const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function (db) {
    const router = express.Router();

    // 验证登录状态
    router.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        if (!token || !process.env.JWT_SECRET) {
            return res.status(401).json({ message: "请先登录" });
        }

        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET);
            next();
        } catch (error) {
            return res.status(401).json({
                message: "登录已过期，请重新登录"
            });
        }
    });

    // 查询成就并自动解锁符合条件的成就
    router.get("/", async (req, res) => {
        const userId = req.user.id;

        try {
            const [focusStats] = await db.execute(
                `SELECT COUNT(*) AS focusCount,
                        COALESCE(SUM(duration), 0) AS totalMinutes
                 FROM focus_records
                 WHERE user_id = ?`,
                [userId]
            );

            const [checkinStats] = await db.execute(
                `SELECT COUNT(DISTINCT checkin_date) AS checkinDays
                 FROM daily_checkins
                 WHERE user_id = ?`,
                [userId]
            );

            const achievements = [
                {
                    code: "first_focus",
                    name: "初次专注",
                    description: "完成第一次专注记录",
                    unlocked: Number(focusStats[0].focusCount) >= 1
                },
                {
                    code: "focus_master",
                    name: "专注达人",
                    description: "累计专注达到 300 分钟",
                    unlocked: Number(focusStats[0].totalMinutes) >= 300
                },
                {
                    code: "checkin_7_days",
                    name: "坚持打卡",
                    description: "累计打卡达到 7 天",
                    unlocked: Number(checkinStats[0].checkinDays) >= 7
                }
            ];

            for (const achievement of achievements) {
                if (achievement.unlocked) {
                    await db.execute(
                        `INSERT IGNORE INTO user_achievements
                         (user_id, achievement_code)
                         VALUES (?, ?)`,
                        [userId, achievement.code]
                    );
                }
            }

            const [unlockedRows] = await db.execute(
                `SELECT achievement_code, unlocked_at
                 FROM user_achievements
                 WHERE user_id = ?`,
                [userId]
            );

            const unlockedMap = new Map(
                unlockedRows.map(row => [
                    row.achievement_code,
                    row.unlocked_at
                ])
            );

            const result = achievements.map(achievement => ({
                code: achievement.code,
                name: achievement.name,
                description: achievement.description,
                unlocked: unlockedMap.has(achievement.code),
                unlockedAt: unlockedMap.get(achievement.code) || null
            }));

            res.json({
                message: "成就查询成功",
                data: result
            });
        } catch (error) {
            console.error("查询成就失败：", error.message);
            res.status(500).json({ message: "查询成就失败" });
        }
    });

    return router;
};
