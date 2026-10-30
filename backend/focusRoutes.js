
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

    // 创建专注记录
    router.post("/", async (req, res) => {
        console.log("收到专注保存请求：", req.body);

const { duration, startTime, endTime } = req.body;
const userId = req.user.id;

// 转换为 MySQL DATETIME 格式
const toMySQLDateTime = (value) => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error("无效的专注时间");
    }

    return date.toISOString().slice(0, 19).replace("T", " ");
};

const mysqlStartTime = toMySQLDateTime(startTime);
const mysqlEndTime = toMySQLDateTime(endTime);


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
                    mysqlStartTime,
                    mysqlEndTime
                ]
            );
            // 专注积分：每分钟 1 分，同一条专注记录只奖励一次
            await db.execute(
                `INSERT IGNORE INTO point_records
                 (user_id, points, source_type, source_id)
                 VALUES (?, ?, 'focus', ?)`,
                [Number(userId), Number(duration), result.insertId]
            );

            res.status(201).json({
                message: "专注记录保存成功",
                id: result.insertId
            });
        } catch (error) {
            console.error("保存专注记录失败：", error);
            res.status(500).json({
                message: "保存专注记录失败，请检查数据库表结构"
            });
        }
    });

    // 查询某个用户的专注记录
    router.get("/", async (req, res) => {
            const userId = req.user.id;

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
