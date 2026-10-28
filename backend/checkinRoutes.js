
const express = require("express");

module.exports = function (db) {
    const router = express.Router();

    // 每日打卡
    router.post("/", async (req, res) => {
        const userId = Number(req.body.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                message: "请提供有效的用户ID"
            });
        }

        try {
            // 每个用户每天只能打卡一次
            const [existing] = await db.execute(
                `SELECT id
                 FROM daily_checkins
                 WHERE user_id = ?
                   AND checkin_date = CURDATE()`,
                [userId]
            );

            if (existing.length > 0) {
                return res.status(409).json({
                    message: "今天已经打过卡了"
                });
            }

            await db.execute(
                `INSERT INTO daily_checkins (user_id, checkin_date)
                 VALUES (?, CURDATE())`,
                [userId]
            );

            res.status(201).json({
                message: "打卡成功",
                data: {
                    userId,
                    checkinDate: new Date().toISOString().slice(0, 10)
                }
            });
        } catch (error) {
            console.error("每日打卡失败：", error.message);
            res.status(500).json({
                message: "打卡失败，请检查数据库表结构"
            });
        }
    });

    // 查询用户的打卡记录
    router.get("/", async (req, res) => {
        const userId = Number(req.query.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                message: "请提供有效的 userId"
            });
        }

        try {
            const [records] = await db.execute(
                `SELECT id, user_id, checkin_date
                 FROM daily_checkins
                 WHERE user_id = ?
                 ORDER BY checkin_date DESC`,
                [userId]
            );

            res.json({
                message: "查询成功",
                data: records
            });
        } catch (error) {
            console.error("查询打卡记录失败：", error.message);
            res.status(500).json({
                message: "查询打卡记录失败，请检查数据库表结构"
            });
        }
    });

    return router;
};
