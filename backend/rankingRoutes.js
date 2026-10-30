
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

    // 获取累计专注时长排行榜
    router.get("/", async (req, res) => {
        try {
            const [rows] = await db.execute(`
                SELECT
                u.id AS userId,
                u.username,
                COALESCE(u.nickname, u.username) AS displayName,
                COALESCE(SUM(fr.duration), 0) AS totalMinutes
                FROM users u
                LEFT JOIN focus_records fr
                    ON fr.user_id = u.id
                GROUP BY u.id, u.username
                ORDER BY totalMinutes DESC, u.id ASC
                LIMIT 100
            `);

            const ranking = rows.map((row, index) => ({
            rank: index + 1,
            userId: row.userId,
            username: row.username,
            displayName: row.displayName,
            totalMinutes: Number(row.totalMinutes)
            }));

            return res.json({
                message: "排行榜查询成功",
                data: ranking
            });
        } catch (error) {
            console.error("查询排行榜失败：", error.message);
            return res.status(500).json({
                message: "查询排行榜失败"
            });
        }
    });

    return router;
};
