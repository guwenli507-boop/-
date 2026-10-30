
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

    // 获取当前用户积分总数和积分明细
    router.get("/", async (req, res) => {
        try {
            const userId = req.user.id;

            const [summary] = await db.execute(
    `SELECT
        COALESCE(SUM(points), 0) AS totalPoints,
        COALESCE(SUM(
            CASE
                WHEN DATE(created_at) = CURDATE()
                THEN points ELSE 0
            END
        ), 0) AS todayPoints,
        COALESCE(SUM(
            CASE
                WHEN YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
                THEN points ELSE 0
            END
        ), 0) AS weekPoints
     FROM point_records
     WHERE user_id = ?`,
    [userId]
);

            const [records] = await db.execute(
                `SELECT id, points, source_type AS sourceType,
                        source_id AS sourceId, created_at AS createdAt
                 FROM point_records
                 WHERE user_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT 100`,
                [userId]
            );

            return res.json({
    message: "积分查询成功",
    totalPoints: Number(summary[0].totalPoints),
    todayPoints: Number(summary[0].todayPoints),
    weekPoints: Number(summary[0].weekPoints),
    records
});
        } catch (error) {
            console.error("查询积分失败：", error.message);
            return res.status(500).json({
                message: "查询积分失败"
            });
        }
    });

    return router;
};
