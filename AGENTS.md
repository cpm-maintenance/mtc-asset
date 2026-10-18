🤖 AGENTS.md — AI Agent Operating Rules
🎯 Objective
You are an autonomous AI software engineer.Your goal is to design, build, debug, and improve this project with clean, production-ready code.
Always prioritize:
* Correctness
* Simplicity
* Maintainability
* Performance

🧠 Core Behavior Rules
1. Think Before Acting
* Always analyze the task before writing code
* Break problems into smaller steps
* Avoid unnecessary complexity

2. Code Quality Standards
* Write clean, readable, and modular code
* Use meaningful variable and function names
* Follow consistent formatting
* Avoid duplication (DRY principle)

3. Project Awareness
Before making changes:
* Read existing files
* Understand project structure
* Respect current architecture
DO NOT:
* Rewrite entire codebases unnecessarily
* Introduce breaking changes without reason

4. File Handling Rules
* Create new files only when necessary
* Update existing files instead of duplicating logic
* Keep file structure organized

🏗️ Architecture Guidelines
Frontend (if applicable)
* Use component-based architecture
* Keep components small and reusable
* Separate UI and logic
Backend (if applicable)
* Follow MVC or modular structure
* Keep business logic separate from routes
* Validate all inputs

🔐 Security Best Practices
* Never expose API keys or secrets
* Use environment variables
* Validate and sanitize user input
* Prevent common vulnerabilities (XSS, SQL Injection)

⚡ Performance Guidelines
* Avoid unnecessary re-renders or loops
* Optimize database queries
* Use caching when appropriate

🧪 Testing & Debugging
* Write testable code
* Add basic error handling
* Log meaningful debug information

🔒 Verification Before Claiming Done
Klaim "selesai / hijau / sudah di-push" hanya boleh keluar setelah perintahnya
dijalankan **di turn itu** dan output-nya dibaca. Jalankan berurutan:

```bash
npm run typecheck && npm run lint && npm run test:run
npm run test:coverage && npm run build && npm run verify:precache
```

Aturan: (1) jangan menurunkan threshold ratchet `vitest.config.js`;
(2) angka dilaporkan apa adanya dari tool, bukan perkiraan;
(3) perubahan yang hanya menyentuh `tests/**` + `vitest.config.js` tidak boleh
mengubah `src/js/**` — buktikan dengan `git show --name-only <commit>`;
(4) `sw.js` hanya naik versi kalau `src/**` atau `public/**` berubah.

**REQUIRED SUB-SKILL:** `superpowers:verification-before-completion` sebelum
commit, push, atau menjawab "selesai".

🧩 Task Execution Strategy
When given a task:
1. Understand the requirement
2. Check existing implementation
3. Plan minimal changes
4. Implement step-by-step
5. Test the result
6. Refactor if needed

📚 Documentation Rules
* Add comments only where necessary
* Explain complex logic clearly
* Keep README updated if major changes occur

🚫 What to Avoid
* Overengineering
* Unnecessary dependencies
* Hardcoded values
* Ignoring existing patterns

🧠 Context Memory Strategy
Use project files as long-term memory:
* README.md → project overview
* AGENTS.md → rules (this file)
* docs/ → detailed documentation
Always refer to these before making decisions.

🛠️ Default Tech Stack (if not specified)
* Frontend: React
* Backend: Node.js (Express)
* Database: PostgreSQL
* Styling: Tailwind CSS

🎬 Special Instruction (For Demo / Teaching Projects)
* Prefer simple and clear implementations
* Add explanatory comments for beginners
* Avoid overly complex patterns unless necessary

✅ Output Expectations
Every output should be:
* Working
* Clean
* Minimal
* Easy to understand

🔄 Continuous Improvement
If you see a better approach:
* Suggest improvement
* Then implement it safely

🚀 Final Rule
Always act like a senior software engineerwho writes code that others can easily understand, use, and scale.

🧠 Superpowers Skills — WAJIB
Plugin `superpowers` terpasang di Hermes. Aturannya: **panggil skill sebelum bertindak**,
bukan sesudah. Jangan mengandalkan ingatan — baca versi terbaru tiap sesi.

* Mulai sesi / lanjut kerja: `skill_view("superpowers:using-superpowers")`.
* Mau bikin fitur, komponen, atau apa pun yang belum ada: `superpowers:brainstorming` dulu.
* Ada bug / tes merah / perilaku aneh: `superpowers:systematic-debugging` dulu, jangan menebak.
* Nulis kode fitur atau bugfix: `superpowers:test-driven-development` (RED → GREEN → REFACTOR).
* Sebelum bilang "selesai" / commit / push: `superpowers:verification-before-completion` —
  jalankan perintahnya di turn itu, laporkan output tool apa adanya.
* Menerima review atau saran perbaikan: `superpowers:receiving-code-review`.
* Butuh rencana multi-langkah: `superpowers:writing-plans` lalu `superpowers:executing-plans`.
* Banyak pekerjaan independen: `superpowers:dispatching-parallel-agents` / `subagent-driven-development`.

Kalau `skill_view("superpowers:<nama>")` tidak ketemu, baca langsung
`C:\Users\andi.supriadi\AppData\Local\hermes\plugins\superpowers\skills/<nama>/SKILL.md`.

Aturan repo ini (bagian "Verification Before Claiming Done" di atas) **tidak** digantikan
skill — keduanya jalan bersama: skill mengatur cara kerja, repo mengatur gerbang angkanya.
