// UTILITIES
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// API FUNCTIONS
async function fetchTasksFromAPI() {
  try {
    // Fetch open issues from React GitHub repository
    const response = await fetch(
      "https://api.github.com/repos/facebook/react/issues?state=open&sort=created&order=desc&per_page=8",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      },
    );
    if (!response.ok) throw new Error("Failed to fetch tasks from GitHub");
    const apiTasks = await response.json();
    return apiTasks;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    Swal.fire(
      "Error",
      "Failed to fetch development tasks from GitHub API",
      "error",
    );
    return [];
  }
}

function convertApiTaskToBoard(apiTask, columnId) {
  const priorities = ["low", "medium", "high"];

  // Determine priority based on labels
  let priority = "medium";
  if (apiTask.labels && apiTask.labels.length > 0) {
    const labels = apiTask.labels.map((l) => l.name.toLowerCase());
    if (labels.some((l) => l.includes("bug"))) priority = "high";
    else if (
      labels.some((l) => l.includes("feature") || l.includes("enhancement"))
    )
      priority = "medium";
    else if (
      labels.some((l) => l.includes("documentation") || l.includes("chore"))
    )
      priority = "low";
  }

  // Create due date based on when issue was created
  const createdDate = new Date(apiTask.created_at);
  const dueDateString = createdDate.toISOString().split("T")[0];

  // Extract tags from GitHub labels
  const tags = apiTask.labels ? apiTask.labels.map((label) => label.name) : [];
  tags.push("GitHub Issue");

  return {
    id: generateUUID(),
    columnId,
    title: apiTask.title,
    description: apiTask.body
      ? apiTask.body.substring(0, 200)
      : `Issue #${apiTask.number} - ${apiTask.html_url}`,
    priority,
    dueDate: dueDateString,
    assignee: apiTask.assignee ? apiTask.assignee.login : "Unassigned",
    tags,
    attachments: [],
    subtasks: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
}

async function addFetchedTasksToColumn(columnId) {
  const todoColumn = boardData.columns.find((col) => col.title === "To Do");
  if (!todoColumn) {
    Swal.fire("Error", "To Do column not found", "error");
    return;
  }

  // Show loading message
  Swal.fire({
    title: "Fetching React Development Tasks...",
    html: "Loading open issues from React GitHub repository",
    allowOutsideClick: false,
    didOpen: async () => {
      Swal.showLoading();
      const apiTasks = await fetchTasksFromAPI();
      if (apiTasks.length > 0) {
        // Convert and add tasks
        apiTasks.forEach((apiTask) => {
          const boardTask = convertApiTaskToBoard(apiTask, todoColumn.id);
          boardData.tasks.push(boardTask);
        });
        saveData();
        renderBoard();
        Swal.fire(
          "Success!",
          `Added ${apiTasks.length} React development tasks to To Do column!`,
          "success",
        );
      } else {
        Swal.fire(
          "No tasks found",
          "Could not fetch tasks from GitHub API",
          "warning",
        );
      }
    },
  });
}

// DATA MANAGEMENT
let boardData = {
  columns: [],
  tasks: [],
};

function saveData() {
  localStorage.setItem("taskflow_data", JSON.stringify(boardData));
}

function loadData() {
  const savedData = localStorage.getItem("taskflow_data");
  if (savedData) {
    boardData = JSON.parse(savedData);
    return true;
  }
  return false;
}

function initializeDefaultData() {
  boardData = {
    columns: [
      { id: generateUUID(), title: "To Do", order: 0 },
      { id: generateUUID(), title: "In Progress", order: 1 },
      { id: generateUUID(), title: "Done", order: 2 },
    ],
    tasks: [],
  };
  saveData();
}

// UI RENDERING
function renderBoard() {
  const boardElement = document.getElementById("board");
  boardElement.innerHTML = "";

  // Sort columns by order
  const sortedColumns = [...boardData.columns].sort(
    (a, b) => a.order - b.order,
  );

  sortedColumns.forEach((column) => {
    const columnTasks = boardData.tasks.filter(
      (task) => task.columnId === column.id,
    );
    const columnElement = createColumnElement(column, columnTasks);
    boardElement.appendChild(columnElement);
  });

  // Add the "Add Column" button at the end
  const addColumnElement = document.createElement("div");
  addColumnElement.className = "add-column-btn";
  addColumnElement.innerHTML = '<i class="fas fa-plus me-2"></i>Add Column';
  addColumnElement.addEventListener("click", () => openColumnModal());
  boardElement.appendChild(addColumnElement);

  // Setup drag and drop
  setupDragAndDrop();
}

function createColumnElement(column, tasks) {
  const columnElement = document.createElement("div");
  columnElement.className = "board-column";
  columnElement.dataset.columnId = column.id;

  // Column header
  const columnHeader = document.createElement("div");
  columnHeader.className = "column-header";
  columnHeader.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="fas fa-grip-vertical column-drag-handle"></i>
      <h5 class="column-title">${escapeHtml(column.title)}</h5>
      <span class="column-task-count ms-2">${tasks.length}</span>
    </div>
    <div class="dropdown">
      <button class="btn btn-sm btn-link text-muted" type="button" data-bs-toggle="dropdown">
        <i class="fas fa-ellipsis-vertical"></i>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><a class="dropdown-item edit-column" href="#"><i class="fas fa-edit me-2"></i>Edit</a></li>
        <li><a class="dropdown-item delete-column" href="#"><i class="fas fa-trash me-2"></i>Delete</a></li>
      </ul>
    </div>
  `;

  // Tasks container
  const tasksContainer = document.createElement("div");
  tasksContainer.className = "tasks-container";
  tasksContainer.dataset.columnId = column.id;

  // Add tasks to container
  tasks.forEach((task) => {
    const taskCard = createTaskCard(task);
    tasksContainer.appendChild(taskCard);
  });

  // Column footer
  const columnFooter = document.createElement("div");
  columnFooter.className = "column-footer";

  // Add special button for "To Do" column
  if (column.title === "To Do") {
    columnFooter.innerHTML = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-sm add-task-btn" data-column-id="${column.id}">
          <i class="fas fa-plus me-2"></i>Add task
        </button>
        <button class="btn btn-sm fetch-tasks-btn" data-column-id="${column.id}" style="background-color: #6366f1; color: white; border: none;">
          <i class="fas fa-download me-2"></i>Fetch Tasks
        </button>
      </div>
    `;
  } else {
    columnFooter.innerHTML = `
      <button class="btn btn-sm add-task-btn" data-column-id="${column.id}">
        <i class="fas fa-plus me-2"></i>Add task
      </button>
    `;
  }

  // Append all parts to column
  columnElement.appendChild(columnHeader);
  columnElement.appendChild(tasksContainer);
  columnElement.appendChild(columnFooter);

  // Setup column event listeners
  columnElement
    .querySelector(".edit-column")
    .addEventListener("click", () => openColumnModal(column));
  columnElement
    .querySelector(".delete-column")
    .addEventListener("click", () => deleteColumn(column.id));
  columnElement
    .querySelector(".add-task-btn")
    .addEventListener("click", () => openTaskModal(null, column.id));

  // Add fetch tasks button listener for "To Do" column
  if (column.title === "To Do") {
    const fetchBtn = columnElement.querySelector(".fetch-tasks-btn");
    if (fetchBtn) {
      fetchBtn.addEventListener("click", () =>
        addFetchedTasksToColumn(column.id),
      );
    }
  }

  return columnElement;
}

function createTaskCard(task) {
  const taskCard = document.createElement("div");
  taskCard.className = "task-card";
  taskCard.dataset.taskId = task.id;
  taskCard.draggable = true;

  // Calculate checklist progress
  let checklistProgress = 0;
  if (task.subtasks && task.subtasks.length > 0) {
    const completed = task.subtasks.filter((st) => st.completed).length;
    checklistProgress = Math.round((completed / task.subtasks.length) * 100);
  }

  // Tags HTML
  let tagsHtml = "";
  if (task.tags && task.tags.length > 0) {
    tagsHtml = `
      <div class="mt-2">
        ${task.tags
          .map((tag) => `<span class="task-tag">${escapeHtml(tag)}</span>`)
          .join("")}
      </div>
    `;
  }

  // Create task card content
  taskCard.innerHTML = `
    <div class="task-title">${escapeHtml(task.title)}</div>
    <div class="task-description">${escapeHtml(task.description || "")}</div>
    ${tagsHtml}
    
    ${
      task.subtasks && task.subtasks.length > 0
        ? `
      <div class="progress-bar">
        <div class="progress-value" style="width: ${checklistProgress}%"></div>
      </div>
      <div class="mt-1 text-muted" style="font-size: 0.75rem;">
        ${task.subtasks.filter((st) => st.completed).length}/${
          task.subtasks.length
        } subtasks
      </div>
    `
        : ""
    }
    
    <div class="task-meta">
      <span class="task-priority priority-${task.priority || "low"}">${
        task.priority || "low"
      }</span>
      
      ${
        task.dueDate
          ? `
        <span class="task-due">
          <i class="far fa-calendar me-1"></i>${formatDate(task.dueDate)}
        </span>
      `
          : ""
      }
      
      ${
        task.assignee
          ? `
        <span class="task-assignee" title="${escapeHtml(task.assignee)}">${getInitials(
          task.assignee,
        )}</span>
      `
          : ""
      }
    </div>
  `;

  // Add event listener to open task modal
  taskCard.addEventListener("click", () => openTaskModal(task));

  // Setup drag events
  taskCard.addEventListener("dragstart", handleDragStart);

  return taskCard;
}

function setupDragAndDrop() {
  const tasksContainers = document.querySelectorAll(".tasks-container");
  const columns = document.querySelectorAll(".board-column");

  // Make columns sortable via drag handles
  const columnHandles = document.querySelectorAll(".column-drag-handle");
  columnHandles.forEach((handle) => {
    handle.addEventListener("mousedown", handleColumnDragStart);
  });

  // Setup drop zones for tasks
  tasksContainers.forEach((container) => {
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("drop", handleDrop);
  });
}

// DRAG AND DROP HANDLERS
let draggedTask = null;
let draggedColumn = null;

function handleDragStart(e) {
  draggedTask = this;
  this.classList.add("dragging");
  // Store the column ID to identify if task moved between columns
  e.dataTransfer.setData("text/plain", this.dataset.taskId);
  e.stopPropagation();
}

function handleDragOver(e) {
  e.preventDefault();
  this.classList.add("dropzone-highlight");
}

function handleDragLeave(e) {
  this.classList.remove("dropzone-highlight");
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove("dropzone-highlight");

  if (!draggedTask) return;

  const taskId = e.dataTransfer.getData("text/plain");
  const targetColumnId = this.dataset.columnId;
  const sourceColumnId = draggedTask.parentElement.dataset.columnId;

  // Find positions
  const targetTasks = Array.from(this.children);
  let targetIndex = targetTasks.length; // Default to end of list

  // Insert at specific position if hovering over a task
  const mouseY = e.clientY;
  for (let i = 0; i < targetTasks.length; i++) {
    const box = targetTasks[i].getBoundingClientRect();
    const boxMiddleY = box.top + box.height / 2;

    if (mouseY < boxMiddleY) {
      targetIndex = i;
      break;
    }
  }

  // Move the task in the DOM
  if (targetIndex < targetTasks.length) {
    this.insertBefore(draggedTask, targetTasks[targetIndex]);
  } else {
    this.appendChild(draggedTask);
  }

  // Update data model
  const taskToMove = boardData.tasks.find((t) => t.id === taskId);
  if (taskToMove) {
    taskToMove.columnId = targetColumnId;
    saveData();
    updateColumnTaskCounts();
  }

  draggedTask.classList.remove("dragging");
  draggedTask = null;
}

function handleColumnDragStart(e) {
  e.stopPropagation();

  const column = this.closest(".board-column");
  draggedColumn = column;

  // Setup column drag events
  const board = document.getElementById("board");

  const onColumnDragOver = (e) => {
    e.preventDefault();
    const currentColumns = Array.from(board.querySelectorAll(".board-column"));
    const mouseX = e.clientX;

    for (let i = 0; i < currentColumns.length; i++) {
      const box = currentColumns[i].getBoundingClientRect();
      const boxMiddleX = box.left + box.width / 2;

      if (mouseX < boxMiddleX && currentColumns[i] !== draggedColumn) {
        board.insertBefore(draggedColumn, currentColumns[i]);
        break;
      } else if (i === currentColumns.length - 1 && mouseX > boxMiddleX) {
        // Insert after last column but before add column button
        const addColumnBtn = board.querySelector(".add-column-btn");
        board.insertBefore(draggedColumn, addColumnBtn);
      }
    }
  };

  const onColumnDragEnd = () => {
    // Update column order in data model
    const newColumnOrder = Array.from(
      board.querySelectorAll(".board-column"),
    ).map((col, idx) => {
      const columnId = col.dataset.columnId;
      const column = boardData.columns.find((c) => c.id === columnId);
      if (column) column.order = idx;
      return column;
    });

    saveData();

    // Clean up event listeners
    document.removeEventListener("mousemove", onColumnDragOver);
    document.removeEventListener("mouseup", onColumnDragEnd);
    draggedColumn = null;
  };

  document.addEventListener("mousemove", onColumnDragOver);
  document.addEventListener("mouseup", onColumnDragEnd);
}

function updateColumnTaskCounts() {
  boardData.columns.forEach((column) => {
    const columnElement = document.querySelector(
      `.board-column[data-column-id="${column.id}"]`,
    );
    if (columnElement) {
      const taskCount = boardData.tasks.filter(
        (t) => t.columnId === column.id,
      ).length;
      columnElement.querySelector(".column-task-count").textContent = taskCount;
    }
  });
}

// TASK MODAL FUNCTIONS
function openTaskModal(task = null, columnId = null) {
  const taskModal = new bootstrap.Modal(document.getElementById("taskModal"));
  const form = document.getElementById("taskForm");
  const modalTitle = document.getElementById("taskModalLabel");
  const deleteBtn = document.getElementById("deleteTaskBtn");

  // Reset form
  form.reset();
  document.getElementById("attachmentsList").innerHTML = "";
  document.getElementById("subtasksList").innerHTML = "";
  document.getElementById("commentsList").innerHTML = "";

  if (task) {
    // Edit existing task
    modalTitle.textContent = "Edit Task";
    document.getElementById("taskId").value = task.id;
    document.getElementById("columnId").value = task.columnId;
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskDescription").value = task.description || "";
    document.getElementById("taskPriority").value = task.priority || "low";
    document.getElementById("taskDueDate").value = task.dueDate || "";
    document.getElementById("taskAssignee").value = task.assignee || "";
    document.getElementById("taskTags").value = task.tags
      ? task.tags.join(", ")
      : "";

    // Load attachments
    if (task.attachments && task.attachments.length > 0) {
      task.attachments.forEach((att) => {
        addAttachmentToList(att.name, att.url);
      });
    }

    // Load subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach((subtask) => {
        addSubtaskToList(subtask.text, subtask.completed);
      });
    }

    // Load comments
    if (task.comments && task.comments.length > 0) {
      task.comments.forEach((comment) => {
        addCommentToList(comment.author, comment.text, comment.date);
      });
    }

    deleteBtn.style.display = "block";
  } else {
    // Create new task
    modalTitle.textContent = "Add New Task";
    document.getElementById("taskId").value = "";
    document.getElementById("columnId").value = columnId;
    deleteBtn.style.display = "none";
  }

  taskModal.show();
}

function saveTask() {
  // Get form values
  const taskId = document.getElementById("taskId").value;
  const columnId = document.getElementById("columnId").value;
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const priority = document.getElementById("taskPriority").value;
  const dueDate = document.getElementById("taskDueDate").value;
  const assignee = document.getElementById("taskAssignee").value.trim();
  const tags = document.getElementById("taskTags").value.trim()
    ? document
        .getElementById("taskTags")
        .value.split(",")
        .map((tag) => tag.trim())
    : [];

  // Get attachments
  const attachmentsElements = document.querySelectorAll(
    "#attachmentsList .task-attachment",
  );
  const attachments = Array.from(attachmentsElements).map((el) => ({
    name: el.dataset.name,
    url: el.dataset.url || "",
  }));

  // Get subtasks
  const subtaskElements = document.querySelectorAll(
    "#subtasksList .checklist-item",
  );
  const subtasks = Array.from(subtaskElements).map((el) => ({
    text: el.querySelector("label").textContent,
    completed: el.querySelector('input[type="checkbox"]').checked,
  }));

  // Get comments
  const commentElements = document.querySelectorAll(
    "#commentsList .task-comment",
  );
  const comments = Array.from(commentElements).map((el) => ({
    author: el.querySelector(".comment-author").textContent,
    text: el.querySelector(".comment-text").textContent,
    date: el.dataset.date || new Date().toISOString(),
  }));

  // Validate
  if (!title) {
    Swal.fire("Oops!", "Please enter a task title.", "warning");
    return;
  }

  if (!columnId) {
    Swal.fire("Oops!", "Column not specified.", "warning");
    return;
  }

  // Create or update task
  if (taskId) {
    // Update existing task
    const taskIndex = boardData.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex >= 0) {
      boardData.tasks[taskIndex] = {
        ...boardData.tasks[taskIndex],
        title,
        description,
        priority,
        dueDate,
        assignee,
        tags,
        attachments,
        subtasks,
        comments,
      };
    }
  } else {
    // Create new task
    const newTask = {
      id: generateUUID(),
      columnId,
      title,
      description,
      priority,
      dueDate,
      assignee,
      tags,
      attachments,
      subtasks,
      comments,
      createdAt: new Date().toISOString(),
    };
    boardData.tasks.push(newTask);
  }

  // Save and refresh
  saveData();
  renderBoard();

  // Close modal
  const taskModal = bootstrap.Modal.getInstance(
    document.getElementById("taskModal"),
  );
  taskModal.hide();
}

function deleteTask(taskId) {
  if (!taskId) return;

  Swal.fire({
    title: "Are you sure?",
    text: "This will delete the task permanently.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete task!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      boardData.tasks = boardData.tasks.filter((task) => task.id !== taskId);
      saveData();
      renderBoard();

      const taskModal = bootstrap.Modal.getInstance(
        document.getElementById("taskModal"),
      );
      if (taskModal) {
        taskModal.hide();
      }

      Swal.fire("Deleted!", "Task has been deleted.", "success");
    }
  });
}

// ATTACHMENT FUNCTIONS
function addAttachmentToList(name, url = "") {
  if (!name) return;

  const attachmentsList = document.getElementById("attachmentsList");
  const attachment = document.createElement("div");
  attachment.className = "task-attachment";
  attachment.dataset.name = name;
  attachment.dataset.url = url;

  attachment.innerHTML = `
<i class="fas fa-paperclip"></i>${escapeHtml(name)}
<button type="button" class="btn btn-sm text-danger ms-2 p-0 remove-attachment">
  <i class="fas fa-times"></i>
</button>
`;

  attachment
    .querySelector(".remove-attachment")
    .addEventListener("click", function () {
      attachment.remove();
    });

  attachmentsList.appendChild(attachment);

  // Clear inputs
  document.getElementById("attachmentName").value = "";
  document.getElementById("attachmentUrl").value = "";
}

// SUBTASK FUNCTIONS
function addSubtaskToList(text, completed = false) {
  if (!text) return;

  const subtasksList = document.getElementById("subtasksList");
  const subtask = document.createElement("div");
  subtask.className = "checklist-item";

  subtask.innerHTML = `
<input type="checkbox" ${completed ? "checked" : ""}>
<label>${escapeHtml(text)}</label>
<button type="button" class="btn btn-sm text-danger ms-2 p-0 remove-subtask">
  <i class="fas fa-times"></i>
</button>
`;

  subtask
    .querySelector(".remove-subtask")
    .addEventListener("click", function () {
      subtask.remove();
    });

  subtasksList.appendChild(subtask);

  // Clear input
  document.getElementById("subtaskText").value = "";
}

// COMMENT FUNCTIONS
function addCommentToList(author, text, date = null) {
  if (!text) return;
  author = author || "You";
  date = date || new Date().toISOString();

  const commentsList = document.getElementById("commentsList");
  const comment = document.createElement("div");
  comment.className = "task-comment";
  comment.dataset.date = date;

  comment.innerHTML = `
<div class="d-flex justify-content-between">
  <span class="comment-author">${escapeHtml(author)}</span>
  <span class="comment-date">${formatDate(date)}</span>
</div>
<div class="comment-text">${escapeHtml(text)}</div>
`;

  commentsList.appendChild(comment);

  // Clear input
  document.getElementById("commentText").value = "";
}

// COLUMN MODAL FUNCTIONS
function openColumnModal(column = null) {
  const columnModal = new bootstrap.Modal(
    document.getElementById("columnModal"),
  );
  const form = document.getElementById("columnForm");
  const modalTitle = document.getElementById("columnModalLabel");
  const deleteBtn = document.getElementById("deleteColumnBtn");

  // Reset form
  form.reset();

  if (column) {
    // Edit existing column
    modalTitle.textContent = "Edit Column";
    document.getElementById("editColumnId").value = column.id;
    document.getElementById("columnTitle").value = column.title;
    deleteBtn.style.display = "block";
  } else {
    // Create new column
    modalTitle.textContent = "Add New Column";
    document.getElementById("editColumnId").value = "";
    deleteBtn.style.display = "none";
  }

  columnModal.show();
}

function saveColumn() {
  // Get form values
  const columnId = document.getElementById("editColumnId").value;
  const title = document.getElementById("columnTitle").value.trim();

  // Validate
  if (!title) {
    Swal.fire("Oops!", "Please enter a column title.", "warning");
    return;
  }

  // Create or update column
  if (columnId) {
    // Update existing column
    const columnIndex = boardData.columns.findIndex((c) => c.id === columnId);
    if (columnIndex >= 0) {
      boardData.columns[columnIndex].title = title;
    }
  } else {
    // Create new column
    const newColumn = {
      id: generateUUID(),
      title,
      order: boardData.columns.length,
    };
    boardData.columns.push(newColumn);
  }

  // Save and refresh
  saveData();
  renderBoard();

  // Close modal
  const columnModal = bootstrap.Modal.getInstance(
    document.getElementById("columnModal"),
  );
  columnModal.hide();
}

function deleteColumn(columnId) {
  if (!columnId) return;

  Swal.fire({
    title: "Are you sure?",
    text: "All tasks in this column will be deleted.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, delete it!",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      boardData.columns = boardData.columns.filter(
        (column) => column.id !== columnId,
      );

      boardData.tasks = boardData.tasks.filter(
        (task) => task.columnId !== columnId,
      );

      boardData.columns.forEach((column, index) => {
        column.order = index;
      });

      saveData();
      renderBoard();

      const columnModal = bootstrap.Modal.getInstance(
        document.getElementById("columnModal"),
      );
      if (columnModal) columnModal.hide();
      Swal.fire("Deleted!", "Your column has been deleted.", "success");
    }
  });
}

// SEARCH FUNCTION
function searchTasks(query) {
  // Remove any existing no-results messages
  document.querySelectorAll(".no-results-msg").forEach((msg) => msg.remove());

  if (!query) {
    renderBoard();
    return;
  }

  query = query.toLowerCase();

  // Find tasks that match the search query
  const matchedTaskIds = boardData.tasks
    .filter((task) => {
      return (
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query)) ||
        (task.tags &&
          task.tags.some((tag) => tag.toLowerCase().includes(query))) ||
        (task.assignee && task.assignee.toLowerCase().includes(query))
      );
    })
    .map((task) => task.id);

  // Hide tasks that don't match
  document.querySelectorAll(".task-card").forEach((card) => {
    if (matchedTaskIds.includes(card.dataset.taskId)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });

  // Show "no results" message in columns where all tasks are hidden
  document.querySelectorAll(".tasks-container").forEach((container) => {
    const allCards = container.querySelectorAll(".task-card");
    const hiddenCards = container.querySelectorAll(
      '.task-card[style*="display: none"]',
    );
    if (allCards.length > 0 && allCards.length === hiddenCards.length) {
      const msg = document.createElement("div");
      msg.className = "no-results-msg text-center text-muted py-3";
      msg.style.fontSize = "0.85rem";
      msg.innerHTML = '<i class="fas fa-search me-1"></i>No matching tasks';
      container.appendChild(msg);
    }
  });
}

// INITIALIZATION
document.addEventListener("DOMContentLoaded", function () {
  // Dark mode: restore saved preference
  const darkModeToggle = document.getElementById("darkModeToggle");
  const savedTheme = localStorage.getItem("taskflow_theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }

  darkModeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    this.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    localStorage.setItem("taskflow_theme", isDark ? "dark" : "light");
  });

  // Check if we have saved data
  const hasData = loadData();

  // Attach getStartedBtn listener once (not conditionally)
  document
    .getElementById("getStartedBtn")
    .addEventListener("click", function () {
      initializeDefaultData();
      document.getElementById("welcomeScreen").style.display = "none";
      document.getElementById("appContainer").style.display = "block";
      renderBoard();
    });

  if (!hasData) {
    // Show welcome screen if no saved data
    document.getElementById("welcomeScreen").style.display = "flex";
    document.getElementById("appContainer").style.display = "none";
  } else {
    // Hide welcome screen if we have data
    document.getElementById("welcomeScreen").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
    renderBoard();
  }

  // Set up event listeners
  document.getElementById("addTaskBtn").addEventListener("click", function () {
    // Default to first column if available
    const firstColumn =
      boardData.columns.length > 0 ? boardData.columns[0].id : null;
    openTaskModal(null, firstColumn);
  });

  document
    .getElementById("addColumnBtn")
    .addEventListener("click", function () {
      openColumnModal();
    });

  document
    .getElementById("floatingAddBtn")
    .addEventListener("click", function () {
      // Default to first column if available
      const firstColumn =
        boardData.columns.length > 0 ? boardData.columns[0].id : null;
      openTaskModal(null, firstColumn);
    });

  document.getElementById("saveTaskBtn").addEventListener("click", saveTask);

  document
    .getElementById("deleteTaskBtn")
    .addEventListener("click", function () {
      const taskId = document.getElementById("taskId").value;
      deleteTask(taskId);
    });

  document
    .getElementById("saveColumnBtn")
    .addEventListener("click", saveColumn);

  document
    .getElementById("deleteColumnBtn")
    .addEventListener("click", function () {
      const columnId = document.getElementById("editColumnId").value;
      deleteColumn(columnId);
    });

  document
    .getElementById("addAttachmentBtn")
    .addEventListener("click", function () {
      const name = document.getElementById("attachmentName").value.trim();
      const url = document.getElementById("attachmentUrl").value.trim();
      addAttachmentToList(name, url);
    });

  document
    .getElementById("addSubtaskBtn")
    .addEventListener("click", function () {
      const text = document.getElementById("subtaskText").value.trim();
      addSubtaskToList(text);
    });

  document
    .getElementById("addCommentBtn")
    .addEventListener("click", function () {
      const text = document.getElementById("commentText").value.trim();
      const author = "You"; // Default author
      addCommentToList(author, text);
    });

  // Auto-grow description textarea (line by line, capped by CSS max-height)
  const descTextarea = document.getElementById("taskDescription");
  descTextarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  // Search functionality
  document
    .getElementById("searchInput")
    .addEventListener("input", function (e) {
      searchTasks(e.target.value.trim());
    });

  // Reset / Delete All Data
  document
    .getElementById("deleteAllDataBtn")
    .addEventListener("click", function () {
      Swal.fire({
        title: "Are you sure?",
        text: "This will delete all data and cannot be undone!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete all!",
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (result.isConfirmed) {
          boardData.columns = [];
          boardData.tasks = [];
          localStorage.removeItem("taskflow_data");
          document.getElementById("welcomeScreen").style.display = "flex";
          document.getElementById("appContainer").style.display = "none";
          Swal.fire(
            "Deleted!",
            "All data has been deleted and reset.",
            "success",
          );
        }
      });
    });
});
