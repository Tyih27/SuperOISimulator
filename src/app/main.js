(function () {
  "use strict";

  const students = [
    { slot: "A1", name: "规划手", role: "单体解题", energy: 92, energyText: "3,680 / 4,000", focus: 40, skill: "最低完成度" },
    { slot: "A2", name: "图论手", role: "单体解题", energy: 84, energyText: "3,360 / 4,000", focus: 60, skill: "最高匹配度", active: true },
    { slot: "A3", name: "结构手", role: "防守辅助", energy: 77, energyText: "3,080 / 4,000", focus: 20, skill: "恢复精力" }
  ];

  const topics = [
    { slot: "B1", name: "树上背包", kind: "动态规划 · 数据结构", difficulty: "800 / 300", progress: 46, progressText: "4,600 / 10,000", state: "进行中", focused: true },
    { slot: "B2", name: "网络流", kind: "图论 · 代码实现", difficulty: "920 / 600", progress: 28, progressText: "2,800 / 10,000", state: "进行中" },
    { slot: "B3", name: "组合计数", kind: "数学", difficulty: "760", progress: 12, progressText: "1,200 / 10,000", state: "进行中" }
  ];

  const skills = [
    { slot: "A1", name: "逐个击破", description: "推进剩余完成度最低的题目", type: "常规" },
    { slot: "A2", name: "匹配攻击", description: "优先选择能力差距最小的题目", type: "常规" },
    { slot: "A3", name: "稳态修复", description: "恢复当前精力最低的学生", type: "辅助" }
  ];

  const logEntries = [
    { time: "R01", message: "战斗准备完成，3 道活动题目进入 B 位。" },
    { time: "A1", message: "规划手锁定 <strong>B1 · 树上背包</strong>，预计推进 <span class=\"accent\">+540</span>。" },
    { time: "B1", message: "树上背包反击 A1，造成 <span class=\"accent\">260 精力</span> 损失。" },
    { time: "A2", message: "图论手进入行动阶段，正在计算匹配度。" }
  ];

  const icon = {
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 3v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3Z"/></svg>'
  };

  function renderStudents() {
    const root = document.querySelector("#student-list");
    root.innerHTML = students.map((student) => `
      <article class="student-card${student.active ? " is-active" : ""}" aria-label="${student.slot} ${student.name}">
        <span class="slot-label">${student.slot}</span>
        <div class="student-name-row">
          <span class="student-name">${student.name}</span>
          <span class="student-role">${student.role}</span>
        </div>
        <div class="stat-line"><span>精力</span><strong>${student.energyText}</strong></div>
        <div class="meter energy" aria-label="精力 ${student.energy}%"><span style="width: ${student.energy}%"></span></div>
        <div class="stat-line"><span>专注</span><strong>${student.focus} / 100</strong></div>
        <div class="meter focus" aria-label="专注 ${student.focus}%"><span style="width: ${student.focus}%"></span></div>
        <div class="student-footer">
          <span class="skill-chip">${student.skill}</span>
          <button class="swap-button" type="button" aria-label="调整 ${student.slot} 站位">${icon.spark} 调整</button>
        </div>
      </article>
    `).join("");
  }

  function renderTopics() {
    const root = document.querySelector("#topic-list");
    root.innerHTML = topics.map((topic) => `
      <article class="topic-card${topic.focused ? " is-focused" : ""}${topic.progress >= 100 ? " is-complete" : ""}" aria-label="${topic.slot} ${topic.name}">
        <span class="slot-label">${topic.slot}</span>
        <div class="topic-name-row">
          <span class="topic-name">${topic.name}</span>
          <span class="topic-difficulty">${topic.difficulty}</span>
        </div>
        <div class="topic-kind">${topic.kind}</div>
        <div class="topic-progress-label"><span>完成进度</span><strong>${topic.progressText}</strong></div>
        <div class="topic-progress" aria-label="${topic.name} 完成进度 ${topic.progress}%"><span style="width: ${topic.progress}%"></span></div>
        <div class="topic-footer"><span class="topic-state">${topic.state}</span><span class="position-badge">正对 ${topic.slot.replace("B", "A")}</span></div>
      </article>
    `).join("");
  }

  function renderSkills() {
    const root = document.querySelector("#skill-list");
    root.innerHTML = skills.map((skill, index) => `
      <div class="skill-row">
        <span class="skill-icon">${index === 2 ? icon.shield : icon.spark}</span>
        <div><div class="skill-name">${skill.slot} · ${skill.name}</div><div class="skill-desc">${skill.description}</div></div>
        <span class="skill-type">${skill.type}</span>
      </div>
    `).join("");
  }

  function renderLog() {
    const root = document.querySelector("#event-log");
    root.innerHTML = logEntries.map((entry) => `
      <div class="log-entry"><span class="log-time">${entry.time}</span><p class="log-message">${entry.message}</p></div>
    `).join("");
  }

  renderStudents();
  renderTopics();
  renderSkills();
  renderLog();
})();
