let dataTable = null;
let columns = [];

$(function () {
  const $form = $("#uploadForm");
  const $files = $("#csvFiles");
  const $fileList = $("#fileList");
  const $loader = $("#loader");
  const $table = $("#dataTable");
  const $tableHead = $("#tableHead");

  // Mostrar lista de archivos seleccionados
  $files.on("change", function () {
    $fileList.empty();
    for (let i = 0; i < this.files.length; i++) {
      $fileList.append(
        `<div class="file-item"><i class="fa fa-file-csv"></i>${this.files[i].name}</div>`
      );
    }
  });

  $form.on("submit", function (e) {
    e.preventDefault();
    const files = $files[0].files;
    if (!files.length) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

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
          columns = res.columns; // nombres reales de columnas
          initDataTable();
        }
      },
      error: function (err) {
        $loader.addClass("d-none");
        console.error(err);
        alert("Error al subir CSV");
      },
    });
  });

  function initDataTable() {
    if (dataTable) {
      dataTable.destroy();
      $tableHead.empty();
    }

    // Encabezados reales
    const headerRow = columns.map((col) => `<th>${col}</th>`).join("");
    $tableHead.html(`<tr>${headerRow}</tr>`);

    const columnDefs = columns.map((_, i) => ({ data: i }));

    dataTable = $table.DataTable({
      processing: true,
      serverSide: true,
      ajax: {
        url: "/data",
        type: "GET",
      },
      columns: columnDefs,
      responsive: true,
      pageLength: 25,
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json",
      },
    });
  }
});
