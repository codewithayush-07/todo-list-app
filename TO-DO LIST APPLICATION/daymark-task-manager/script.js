
const STORAGE_KEY = "daymark_tasks_v1";
const THEME_KEY = "daymark_theme_v1";

const $ = (id) => document.getElementById(id);

const form = $("taskForm");

let tasks = [];
let toastTimer;

// Load saved tasks
try {
    const savedTasks = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
    );

    tasks = Array.isArray(savedTasks)
        ? savedTasks.filter(
            task =>
                task &&
                task.id &&
                typeof task.title === "string"
        )
        : [];
} catch (error) {
    tasks = [];
}

// Restore saved theme
try {
    if (localStorage.getItem(THEME_KEY) === "dark") {
        document.body.classList.add("dark");
    }
} catch (error) {}

// Save tasks to Local Storage
function persist() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(tasks)
        );
    } catch (error) {
        showToast("Unable to save tasks. Check browser storage.");
    }
}

// Escape user-provided text before displaying it as HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

// Format dates
function formatDate(date) {
    if (!date) return "";

    const formattedDate = new Date(date + "T00:00:00");

    if (Number.isNaN(formattedDate.getTime())) {
        return "";
    }

    return formattedDate.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// Show notification
function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
}

// Reset the task form
function clearForm() {
    form.reset();

    $("taskId").value = "";
    $("formHeading").textContent = "Create a task";
    $("saveBtn").textContent = "Add task";
    $("cancelBtn").hidden = true;
    $("formError").textContent = "";
}

// Render tasks and update dashboard statistics
function render() {
    const completed = tasks.filter(
        task => task.completed
    ).length;

    const pending = tasks.length - completed;

    $("totalCount").textContent = tasks.length;
    $("completedCount").textContent = completed;
    $("pendingCount").textContent = pending;

    const percentage = tasks.length
        ? Math.round((completed / tasks.length) * 100)
        : 0;

    $("progressFill").style.width = percentage + "%";

    $("progressText").textContent = tasks.length
        ? `${completed} of ${tasks.length} completed`
        : "No tasks completed yet";

    $("progressPercent").textContent = percentage + "%";

    // Get search and filter values
    const query = $("searchInput")
        .value.trim().toLowerCase();

    const status = $("statusFilter").value;
    const category = $("categoryFilter").value;

    // Filter and sort tasks
    const filteredTasks = tasks
        .filter(task => {
            const searchableText = (
                task.title + " " +
                (task.description || "") + " " +
                (task.category || "")
            ).toLowerCase();

            const matchesSearch =
                searchableText.includes(query);

            const matchesStatus =
                status === "all" ||
                (status === "completed" && task.completed) ||
                (status === "pending" && !task.completed);

            const matchesCategory =
                category === "all" ||
                task.category === category;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesCategory
            );
        })
        .sort((a, b) => {
            // Pending tasks appear first
            const statusOrder =
                Number(a.completed) - Number(b.completed);

            if (statusOrder !== 0) {
                return statusOrder;
            }

            // Earlier due dates appear first
            const dueA = a.dueDate || "9999-12-31";
            const dueB = b.dueDate || "9999-12-31";

            if (dueA !== dueB) {
                return dueA.localeCompare(dueB);
            }

            return b.createdAt - a.createdAt;
        });

    $("visibleCount").textContent =
        `${filteredTasks.length} ${
            filteredTasks.length === 1 ? "task" : "tasks"
        }`;

    const taskList = $("taskList");

    // Empty state
    if (filteredTasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty">
                <div class="empty-icon">✦</div>
                <strong>
                    ${
                        tasks.length
                            ? "No matching tasks"
                            : "Your list is a blank canvas"
                    }
                </strong>
                <div style="margin-top: 6px; font-size: .88rem">
                    ${
                        tasks.length
                            ? "Try another search or filter."
                            : "Add your first task and get started."
                    }
                </div>
            </div>
        `;

        return;
    }

    // Today's date for overdue detection
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Display task cards
    taskList.innerHTML = filteredTasks.map(task => {
        const overdue =
            task.dueDate &&
            new Date(task.dueDate + "T00:00:00") < today &&
            !task.completed;

        const priority = [
            "high", "medium", "low"
        ].includes(task.priority)
            ? task.priority
            : "medium";

        return `
            <article class="task ${
                task.completed ? "completed" : ""
            }">

                <input
                    class="check"
                    type="checkbox"
                    data-action="toggle"
                    data-id="${escapeHTML(task.id)}"
                    aria-label="Mark task as ${
                        task.completed ? "pending" : "completed"
                    }"
                    ${task.completed ? "checked" : ""}
                >

                <div class="task-main">
                    <div class="task-title">
                        ${escapeHTML(task.title)}
                    </div>

                    ${
                        task.description
                            ? `<div class="task-desc">${
                                escapeHTML(task.description)
                            }</div>`
                            : ""
                    }

                    <div class="task-meta">
                        <span class="tag">
                            ${escapeHTML(task.category || "Other")}
                        </span>

                        <span class="tag priority-${priority}">
                            ${
                                priority.charAt(0).toUpperCase() +
                                priority.slice(1)
                            } priority
                        </span>

                        ${
                            task.dueDate
                                ? `<span class="due ${
                                    overdue ? "overdue" : ""
                                }">
                                    ${
                                        overdue
                                            ? "Overdue · "
                                            : "Due "
                                    }
                                    ${escapeHTML(formatDate(task.dueDate))}
                                </span>`
                                : ""
                        }
                    </div>
                </div>

                <div class="task-actions">
                    <button
                        class="tiny-btn"
                        data-action="edit"
                        data-id="${escapeHTML(task.id)}"
                        aria-label="Edit task"
                        title="Edit"
                    >✎</button>

                    <button
                        class="tiny-btn"
                        data-action="delete"
                        data-id="${escapeHTML(task.id)}"
                        aria-label="Delete task"
                        title="Delete"
                    >×</button>
                </div>
            </article>
        `;
    }).join("");
}

// Edit an existing task
function editTask(id) {
    const task = tasks.find(
        task => task.id === id
    );

    if (!task) return;

    $("taskId").value = task.id;
    $("taskTitle").value = task.title;
    $("taskDescription").value = task.description || "";
    $("taskCategory").value = task.category || "Personal";
    $("taskPriority").value = task.priority || "medium";
    $("taskDue").value = task.dueDate || "";

    $("formHeading").textContent = "Edit task";
    $("saveBtn").textContent = "Save changes";
    $("cancelBtn").hidden = false;
    $("formError").textContent = "";

    $("editorPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    $("taskTitle").focus({ preventScroll: true });
}

// Add a new task or update an existing one
form.addEventListener("submit", function(event) {
    event.preventDefault();

    const title = $("taskTitle").value.trim();
    const description = $("taskDescription").value.trim();
    const dueDate = $("taskDue").value;

    // Validate task name
    if (!title) {
        $("formError").textContent =
            "Please enter a task name.";

        $("taskTitle").focus();
        return;
    }

    if (title.length > 100) {
        $("formError").textContent =
            "Task names must be 100 characters or fewer.";

        return;
    }

    // Validate optional due date
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        $("formError").textContent =
            "Please enter a valid due date.";

        return;
    }

    const id = $("taskId").value;

    const existingTask = tasks.find(
        task => task.id === id
    );

    const taskData = {
        id: id || (
            window.crypto && crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()) +
                    Math.random().toString(16).slice(2)
        ),

        title: title,
        description: description,
        category: $("taskCategory").value,
        priority: $("taskPriority").value,
        dueDate: dueDate,

        // Preserve completion status when editing
        completed: existingTask
            ? existingTask.completed
            : false,

        createdAt: existingTask
            ? existingTask.createdAt
            : Date.now(),

        updatedAt: Date.now()
    };

    if (existingTask) {
        tasks = tasks.map(task =>
            task.id === id ? taskData : task
        );

        showToast("Task updated successfully");
    } else {
        tasks.unshift(taskData);

        showToast("Task added successfully");
    }

    persist();
    clearForm();
    render();
});

// Handle edit and delete buttons
$("taskList").addEventListener("click", function(event) {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "edit") {
        editTask(id);
    }

    if (action === "delete") {
        const task = tasks.find(
            task => task.id === id
        );

        if (!task) return;

        const confirmed = confirm(
            `Delete "${task.title}"? This cannot be undone.`
        );

        if (!confirmed) return;

        tasks = tasks.filter(
            task => task.id !== id
        );

        if ($("taskId").value === id) {
            clearForm();
        }

        persist();
        render();

        showToast("Task deleted");
    }
});

// Mark a task completed or pending
$("taskList").addEventListener("change", function(event) {
    const checkbox = event.target.closest(
        '[data-action="toggle"]'
    );

    if (!checkbox) return;

    const task = tasks.find(
        task => task.id === checkbox.dataset.id
    );

    if (!task) return;

    task.completed = checkbox.checked;
    task.updatedAt = Date.now();

    persist();
    render();

    showToast(
        task.completed
            ? "Task completed — nice work!"
            : "Task marked as pending"
    );
});

// Search tasks as the user types
$("searchInput").addEventListener("input", render);

// Filter by status
$("statusFilter").addEventListener("change", render);

// Filter by category
$("categoryFilter").addEventListener("change", render);

// Open a fresh task form
$("newTaskBtn").addEventListener("click", function() {
    clearForm();
    $("taskTitle").focus();

    if (window.matchMedia("(max-width: 850px)").matches) {
        $("editorPanel").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
});

// Cancel editing
$("cancelBtn").addEventListener("click", clearForm);

// Toggle dark mode
function updateThemeButton() {
    const isDark = document.body.classList.contains("dark");

    $("themeBtn").innerHTML = isDark
        ? '☀ <span id="themeLabel">Light mode</span>'
        : '☾ <span id="themeLabel">Dark mode</span>';
}

$("themeBtn").addEventListener("click", function() {
    document.body.classList.toggle("dark");

    const theme = document.body.classList.contains("dark")
        ? "dark"
        : "light";

    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {}

    updateThemeButton();
});

// Restore theme button label
updateThemeButton();

// Initial rendering
render();
