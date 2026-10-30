
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

    // 每日打卡
    router.post("/", async (req, res) => {
        const userId = req.user.id;

        try {
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

                        const [result] = await db.execute(
                `INSERT INTO daily_checkins (user_id, checkin_date)
                 VALUES (?, CURDATE())`,
                [userId]
            );

            // 每日打卡奖励 5 分，同一条打卡记录只奖励一次
            await db.execute(
                `INSERT IGNORE INTO point_records
                 (user_id, points, source_type, source_id)
                 VALUES (?, 5, 'checkin', ?)`,
                [userId, result.insertId]
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

    // 查询当前登录用户的打卡记录
    router.get("/", async (req, res) => {
        const userId = req.user.id;

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
