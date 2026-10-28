
const express = require("express");

module.exports = function (db) {
    const router = express.Router();

    // 创建专注记录
    router.post("/", async (req, res) => {
        const { userId, duration, startTime, endTime } = req.body;

        if (!userId || !Number.isInteger(Number(duration)) || Number(duration) <= 0) {
            return res.status(400).json({
                message: "用户ID和有效的专注时长不能为空"
            });
        }

        try {
            // 暂时使用参数化 SQL，防止 SQL 注入。
            // 表名和字段需要根据现有数据库结构确认后再启用。
            const [result] = await db.execute(
                `INSERT INTO focus_records
                 (user_id, duration, start_time, end_time)
                 VALUES (?, ?, ?, ?)`,
                [
                    Number(userId),
                    Number(duration),
                    startTime || null,
                    endTime || null
                ]
            );

            res.status(201).json({
                message: "专注记录保存成功",
                id: result.insertId
            });
        } catch (error) {
            console.error("保存专注记录失败：", error.message);
            res.status(500).json({
                message: "保存专注记录失败，请检查数据库表结构"
            });
        }
    });

    // 查询某个用户的专注记录
    router.get("/", async (req, res) => {
        const userId = Number(req.query.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                message: "请提供有效的 userId"
            });
        }

        try {
            const [records] = await db.execute(
                `SELECT id, user_id, duration, start_time, end_time
                 FROM focus_records
                 WHERE user_id = ?
                 ORDER BY start_time DESC`,
                [userId]
            );

            res.json({
                message: "查询成功",
                data: records
            });
        } catch (error) {
            console.error("查询专注记录失败：", error.message);
            res.status(500).json({
                message: "查询专注记录失败，请检查数据库表结构"
            });
        }
    });

    return router;
};
