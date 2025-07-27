let dataTable = null;
let columns = [];
let selectedFiles = [];
let excludedClients = [];
let savedSearch = ""; // para controlar el texto de búsqueda guardado

$(function () {
  const $files = $("#csvFiles");
  const $fileList = $("#fileList");
  const $loader = $("#loader");
  const $table = $("#dataTable");
  const $tableHead = $("#tableHead");
  const $clearBtn = $("#clearBtn");
  const $clientsList = $("#clientsList");
  const $applyExcludeClients = $("#applyExcludeClients");
  const $selectAllClients = $("#selectAllClients");
  const $deselectAllClients = $("#deselectAllClients");

  // Contenedor inline para los excluidos (se inserta cuando exista el filtro)
  let $excludedDisplay = null;

  // ---- Restaurar estado desde localStorage (solo si NO se cargan nuevos archivos) ----
  try {
    excludedClients = JSON.parse(localStorage.getItem("excludedClients")) || [];
    columns = JSON.parse(localStorage.getItem("columns")) || [];
    savedSearch = localStorage.getItem("searchText") || "";
  } catch {
    excludedClients = [];
    columns = [];
    savedSearch = "";
  }

  /* ------------------------ Utilidades de estado ------------------------ */

  function saveState() {
    const currentSearchInput = $(".dataTables_filter input");
    const toSaveSearch =
      currentSearchInput.length > 0 ? currentSearchInput.val() : savedSearch;
    localStorage.setItem("excludedClients", JSON.stringify(excludedClients));
    localStorage.setItem("searchText", toSaveSearch || "");
    localStorage.setItem("columns", JSON.stringify(columns));
  }

  function hardResetStateForNewUpload() {
    // Limpia TODO para una nueva carga
    excludedClients = [];
    savedSearch = "";
    localStorage.removeItem("excludedClients");
    localStorage.removeItem("searchText");
    localStorage.removeItem("columns");

    // Destruye DataTable y limpia UI
    if (dataTable) {
      dataTable.clear().destroy();
      $tableHead.empty();
      dataTable = null;
    }

    if ($excludedDisplay) {
      $excludedDisplay.text("");
    }

    // Limpia el input de búsqueda si existe (si hay DT viejo)
    const $searchInput = $(".dataTables_filter input");
    if ($searchInput.length) {
      $searchInput.val("");
    }

    updateExclusionBadge();
    updateExcludedDisplay();
  }

  /* ------------------------ UI helpers ------------------------ */

  function showToast(message, type = "info") {
    const toastId = "toast-" + Date.now();
    const bgClass =
      type === "success"
        ? "bg-success text-white"
        : type === "danger"
        ? "bg-danger text-white"
        : type === "warning"
        ? "bg-warning"
        : "bg-info text-white";

    const html = `
      <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow-sm" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>`;
    $("#toastContainer").append(html);

    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
  }

  function debounce(func, delay) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, arguments), delay);
    };
  }

  function normalizeText(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function highlightMatch(text, search) {
    if (!search || !text) return text;
    const normSearch = normalizeText(search);
    if (!normSearch) return text;
    let result = "";
    let buffer = "";
    let normBuffer = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const normChar = normalizeText(char);
      buffer += char;
      normBuffer += normChar;
      while (normBuffer.length > normSearch.length) {
        result += buffer[0];
        buffer = buffer.slice(1);
        normBuffer = normalizeText(buffer);
      }
      if (normBuffer === normSearch) {
        result += `<span class="highlight">${buffer}</span>`;
        buffer = "";
        normBuffer = "";
      }
    }
    return result + buffer;
  }

  /* ------------------------ Manejo de archivos ------------------------ */

  $files.on("change", function () {
    const newFiles = Array.from(this.files);
    newFiles.forEach((f) => {
      if (
        !selectedFiles.some((sf) => sf.name === f.name && sf.size === f.size)
      ) {
        selectedFiles.push(f);
      }
    });
    renderFileList();
    $files.val("");
  });

  function renderFileList() {
    $fileList.empty();
    selectedFiles.forEach((file, index) => {
      $fileList.append(
        `<div class="file-item">
          <i class="fa fa-file-csv"></i>${file.name}
          <i class="fa fa-times" data-index="${index}" title="Eliminar"></i>
        </div>`
      );
    });
  }

  $fileList.on("click", ".fa-times", function () {
    const index = $(this).data("index");
    selectedFiles.splice(index, 1);
    renderFileList();
  });

  $("#uploadForm").on("submit", function (e) {
    e.preventDefault();
    if (!selectedFiles.length) {
      showToast("No ha seleccionado archivos.", "warning");
      return;
    }

    // *** RESETEA TODO **ANTES** de subir (según requerimiento) ***
    hardResetStateForNewUpload();

    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("files", f));

    $loader.removeClass("d-none");

    $.ajax({
      url: "/upload/",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (res) {
        $loader.addClass("d-none");
        if (res.status === "ok") {
          columns = res.columns;
          // Guardamos columnas nuevas y search vacío
          saveState();
          initDataTable();
        }
      },
      error: function () {
        $loader.addClass("d-none");
        showToast("Error al subir CSV", "danger");
      },
    });
  });

  /* ------------------------ DataTables ------------------------ */

  function initExcludedDisplayIfNeeded() {
    if (!$excludedDisplay) {
      $excludedDisplay = $(
        "<div id='excludedListDisplay' class='mt-2 text-muted small'></div>"
      );
    }
    // Inserta bajo el buscador de DataTables
    const $filter = $("#dataTable_filter");
    if ($filter.length && !$filter.next("#excludedListDisplay").length) {
      $filter.after($excludedDisplay);
    }
  }

  function initDataTable() {
    if (dataTable) {
      dataTable.clear().destroy();
      $tableHead.empty();
      dataTable = null;
    }

    const headerRow = columns
      .map((col) => {
        let className = "";
        if (col.toLowerCase() === "fecha") className = "fecha-col";
        if (col.toLowerCase() === "descripcion") className = "descripcion-col";
        return `<th class="${className}">${col}</th>`;
      })
      .join("");
    $tableHead.html(`<tr>${headerRow}</tr>`);

    const columnDefs = columns.map((col, i) => {
      if (col.toLowerCase() === "descripcion") {
        return {
          data: i,
          render: (data) =>
            highlightMatch(data, $(".dataTables_filter input").val() || ""),
        };
      }
      return { data: i };
    });

    dataTable = $table.DataTable({
      processing: true,
      serverSide: true,
      ajax: {
        url: "/data",
        type: "GET",
        data: (d) => {
          d.desc_regex = $(".dataTables_filter input").val() || "";
          d.excluded_clients = JSON.stringify(excludedClients);
        },
      },
      columns: columnDefs,
      scrollX: true,
      autoWidth: false,
      pageLength: 25,
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json",
      },
      initComplete: function () {
        const $filter = $("#dataTable_filter");

        if (!$("#excludeBtnDT").length) {
          $filter.append(`
            <button id="excludeBtnDT" class="btn btn-outline-secondary btn-sm ms-2 square-btn" 
              title="Excluir clientes">
              <i class="fa fa-user-slash"></i>
              <span id="excludeCount" class="badge rounded-pill bg-danger d-none">0</span>
            </button>
            <button id="resetExcludedBtnDT" class="btn btn-outline-secondary btn-sm ms-2 square-btn" title="Reincluir clientes excluidos">
              <i class="fa fa-rotate"></i>
            </button>
            <button id="resetFilters" class="btn btn-outline-secondary btn-sm ms-2 square-btn" title="Limpiar filtros y búsqueda">
              <i class="fa fa-filter-circle-xmark"></i>
            </button>
          `);

          $("#excludeBtnDT")
            .off("click")
            .on("click", () => {
              loadClientes();
              $("#excludeClientsModal").modal("show");
            });

          $("#resetExcludedBtnDT").off("click").on("click", resetExcludedOnly);
          $("#resetFilters").off("click").on("click", resetFilters);
        }

        // Crear/colocar el display inline de excluidos
        initExcludedDisplayIfNeeded();
        updateExclusionBadge();
        updateExcludedDisplay();

        // *** Como venimos de una nueva carga, aseguramos búsqueda vacía ***
        $(".dataTables_filter input").val("");
        dataTable.search("").draw();
        saveState();
      },
    });

    $(".dataTables_filter input")
      .off()
      .on(
        "keyup change",
        debounce(() => {
          saveState();
          dataTable.ajax.reload(null, false);
        }, 400)
      );
  }

  /* ------------------------ Clientes (modal) ------------------------ */

  function loadClientes() {
    const currentFilter = $(".dataTables_filter input").val() || "";
    $.get("/clientes", { desc_regex: currentFilter }, function (res) {
      $clientsList.empty();
      res.clientes.forEach((cliente) => {
        const checked = excludedClients.includes(cliente) ? "checked" : "";
        $clientsList.append(`
          <div class="form-check">
            <input class="form-check-input client-check" type="checkbox" value="${cliente}" ${checked}>
            <label class="form-check-label">${cliente}</label>
          </div>
        `);
      });
    });
  }

  $applyExcludeClients.on("click", function () {
    excludedClients = $(".client-check:checked")
      .map(function () {
        return $(this).val();
      })
      .get();
    saveState();
    $("#excludeClientsModal").modal("hide");
    updateExclusionBadge();
    updateExcludedDisplay();
    showToast(`${excludedClients.length} clientes excluidos.`, "warning");
    if (dataTable) dataTable.ajax.reload(null, false);
  });

  function resetExcludedOnly() {
    if (!excludedClients.length) {
      showToast("No hay clientes excluidos para reincluir.", "info");
      return;
    }
    excludedClients = [];
    saveState();
    updateExclusionBadge();
    updateExcludedDisplay();
    showToast("Clientes excluidos reincluidos.", "success");
    if (dataTable) dataTable.ajax.reload(null, false);
  }

  function resetFilters() {
    excludedClients = [];
    savedSearch = "";
    saveState();

    if (dataTable) {
      dataTable.search("").draw(); // limpia el input y el filtro interno
      dataTable.ajax.reload(null, false);
    }

    updateExclusionBadge();
    updateExcludedDisplay();

    const $searchInput = $(".dataTables_filter input");
    if ($searchInput.length) $searchInput.val("");

    showToast("Filtros y búsqueda limpiados.", "info");
  }

  function updateExclusionBadge() {
    const $badge = $("#excludeCount");
    if (!$badge.length) return;
    if (excludedClients.length > 0) {
      $badge.text(excludedClients.length).removeClass("d-none");
    } else {
      $badge.addClass("d-none");
    }
  }

  function updateExcludedDisplay() {
    if (!$excludedDisplay) return;
    if (!excludedClients.length) {
      $excludedDisplay.text("");
    } else {
      $excludedDisplay.text("Excluidos: " + excludedClients.join(", "));
    }
  }

  // Botones del modal
  $selectAllClients.on("click", () => $(".client-check").prop("checked", true));
  $deselectAllClients.on("click", () =>
    $(".client-check").prop("checked", false)
  );

  /* ------------------------ Limpiar todo ------------------------ */

  $clearBtn.on("click", function () {
    $.post("/clear", function (res) {
      if (res.status === "cleared") {
        selectedFiles = [];
        hardResetStateForNewUpload(); // reutilizamos el reset completo
        $files.val("");
        $fileList.empty();
        showToast("Información reseteada.", "success");
      } else {
        showToast("No hay información para reiniciar.", "info");
      }
    });
  });

  /* ------------------------ Restaurar tabla si ya había datos ------------------------ */

  if (columns.length) {
    initDataTable();
    // Restaurar búsqueda si existía (cuando NO es nueva carga)
    if (savedSearch) {
      $(".dataTables_filter input").val(savedSearch);
      if (dataTable) {
        dataTable.search(savedSearch).draw();
      }
      updateExcludedDisplay();
      updateExclusionBadge();
    }
  }
});
