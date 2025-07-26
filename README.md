# Datalens

Datalens es una aplicación web en **FastAPI** para subir, visualizar y filtrar archivos CSV de forma interactiva, utilizando **DataTables** y **Bootstrap**.

## Características

- Subida de múltiples archivos CSV.
- Visualización con búsqueda, filtros y paginación.
- Server-Side Processing para manejar grandes volúmenes de datos.
- Diseño moderno con Bootstrap 5.

## Requisitos

- Python 3.9+
- pip

## Instalación

```bash
git clone <url-del-repo>
cd datalens
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Ejecución

```bash
uvicorn main:app --reload --port 8000
```

## Estructura

datalens/
├── main.py
├── templates/
│ └── index.html
├── static/
│ ├── style.css
│ └── app.js
└── README.md
