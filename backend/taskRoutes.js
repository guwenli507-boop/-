const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function (db) {
    const router = express.Router();

    // 从 JWT Token 识别当前用户
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
            return res.status(401).json({ message: "登录已过期，请重新登录" });
        }
    });

    // 查询当前用户的任务
    router.get("/", async (req, res) => {
        try {
            const [tasks] = await db.execute(
                `SELECT id, title, description, deadline, status, created_at
                 FROM tasks WHERE user_id = ? ORDER BY created_at DESC`,
                [req.user.id]
            );
            res.json({ tasks });
        } catch (error) {
            console.error("查询任务失败：", error.message);
            res.status(500).json({ message: "获取任务列表失败" });
        }
    });

    // 创建任务
    router.post("/", async (req, res) => {
        const { title, description, deadline } = req.body;

        if (!title || typeof title !== "string" || !title.trim()) {
            return res.status(400).json({ message: "任务名称不能为空" });
        }

        try {
            const [result] = await db.execute(
                `INSERT INTO tasks (user_id, title, description, deadline)
                 VALUES (?, ?, ?, ?)`,
                [
                    req.user.id,
                    title.trim(),
                    description || null,
                    deadline || null
                ]
            );

const [tasks] = await db.execute(
    `SELECT id, title, description, deadline, status, created_at
     FROM tasks
     WHERE id = ? AND user_id = ?`,
    [result.insertId, req.user.id]
);

res.status(201).json({
    message: "任务创建成功",
    task: tasks[0]
});            res.status(201).json({
                message: "任务创建成功",
                taskId: result.insertId
            });
        } catch (error) {
            console.error("创建任务失败：", error.message);
            res.status(500).json({ message: "创建任务失败，请检查截止时间格式" });
        }
    });

    // 更新任务状态
    router.patch("/:id", async (req, res) => {
        const { status } = req.body;

        if (!["pending", "completed"].includes(status)) {
            return res.status(400).json({ message: "任务状态无效" });
        }

        try {
                        const [tasks] = await db.execute(
                "SELECT status FROM tasks WHERE id = ? AND user_id = ?",
                [req.params.id, req.user.id]
            );

            if (tasks.length === 0) {
                return res.status(404).json({ message: "任务不存在" });
            }

            const previousStatus = tasks[0].status;

            const [result] = await db.execute(
                "UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?",
                [status, req.params.id, req.user.id]
            );

            // 仅在任务首次完成时奖励 10 分
            if (previousStatus !== "completed" && status === "completed") {
                await db.execute(
                    `INSERT IGNORE INTO point_records
                     (user_id, points, source_type, source_id)
                     VALUES (?, 10, 'task', ?)`,
                    [req.user.id, Number(req.params.id)]
                );
            }

            res.json({ message: "任务状态更新成功" });
        } catch (error) {
            console.error("更新任务失败：", error.message);
            res.status(500).json({ message: "更新任务失败" });
        }
    });

    // 删除当前用户的任务
    router.delete("/:id", async (req, res) => {
        try {
            const [result] = await db.execute(
                "DELETE FROM tasks WHERE id = ? AND user_id = ?",
                [req.params.id, req.user.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "任务不存在" });
            }

            res.json({ message: "任务删除成功" });
        } catch (error) {
            console.error("删除任务失败：", error.message);
            res.status(500).json({ message: "删除任务失败" });
        }
    });

    return router;
};
