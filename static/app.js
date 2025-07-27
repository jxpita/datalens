let dataTable = null;

$(function () {
  const $form = $("#uploadForm");
  const $files = $("#csvFiles");
  const $loader = $("#loader");
  const $table = $("#dataTable");
  const $tableHead = $("#tableHead");

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

    // Obtener cabeceras del primer lote de datos (fetch 1 página para columnas)
    $.get("/data?start=0&length=1", function (res) {
      if (!res.data || res.data.length === 0) {
        alert("No hay datos para mostrar");
        return;
      }

      // Construir encabezado
      const columns = Object.keys(res.data[0]).map((_, i) => ({ data: i }));
      const headerRow = Object.keys(res.data[0])
        .map((_, i) => `<th>Col ${i + 1}</th>`)
        .join("");
      $tableHead.html(`<tr>${headerRow}</tr>`);

      dataTable = $table.DataTable({
        processing: true,
        serverSide: true,
        ajax: {
          url: "/data",
          type: "GET",
        },
        columns: columns,
        responsive: true,
        pageLength: 25,
        language: {
          url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json",
        },
      });
    });
  }
});
