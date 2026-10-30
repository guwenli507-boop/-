const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function (db) {
    const router = express.Router();

    // 验证当前用户是否已登录
    router.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        if (!token || !process.env.JWT_SECRET) {
            return res.status(401).json({
                message: "请先登录"
            });
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

    // 查询当前登录用户的专注统计数据
    router.get("/focus", async (req, res) => {
        const userId = req.user.id;

        try {
            // 今日和本周专注统计
            const [summaryRows] = await db.execute(
                `SELECT
                    COALESCE(SUM(
                        CASE
                            WHEN DATE(start_time) = CURDATE()
                            THEN duration ELSE 0
                        END
                    ), 0) AS todayMinutes,
                    COALESCE(SUM(
                        CASE
                            WHEN YEARWEEK(start_time, 1) =
                                 YEARWEEK(CURDATE(), 1)
                            THEN duration ELSE 0
                        END
                    ), 0) AS weekMinutes,
                    COUNT(
                        CASE
                            WHEN DATE(start_time) = CURDATE()
                            THEN 1
                        END
                    ) AS todaySessions,
                    COUNT(*) AS totalSessions
                 FROM focus_records
                 WHERE user_id = ?
                   AND start_time IS NOT NULL`,
                [userId]
            );

            // 最近7天每日专注时长
            const [dailyRows] = await db.execute(
                `SELECT
                    DATE(start_time) AS date,
                    COALESCE(SUM(duration), 0) AS minutes,
                    COUNT(*) AS sessions
                 FROM focus_records
                 WHERE user_id = ?
                   AND start_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                   AND start_time < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                 GROUP BY DATE(start_time)
                 ORDER BY DATE(start_time) ASC`,
                [userId]
            );

            res.json({
                message: "统计查询成功",
                data: {
                    summary: summaryRows[0],
                    dailyTrend: dailyRows
                }
            });
        } catch (error) {
            console.error("专注统计查询失败：", error.message);
            res.status(500).json({
                message: "统计查询失败，请检查数据库表结构"
            });
        }
    });

    // 查询当前登录用户的打卡统计
    router.get("/checkins", async (req, res) => {
        const userId = req.user.id;

        try {
            const [rows] = await db.execute(
                `SELECT
                    COUNT(*) AS totalCheckins,
                    COALESCE(SUM(checkin_date = CURDATE()), 0) AS checkedInToday
                 FROM daily_checkins
                 WHERE user_id = ?`,
                [userId]
            );

            res.json({
                message: "打卡统计查询成功",
                data: rows[0]
            });
        } catch (error) {
            console.error("打卡统计查询失败：", error.message);
            res.status(500).json({
                message: "打卡统计查询失败，请检查数据库表结构"
            });
        }
    });

    return router;
};
