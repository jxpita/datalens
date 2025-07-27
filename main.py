from fastapi import FastAPI, Request, UploadFile, File, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import List, Optional
import pandas as pd
import unicodedata
import re
import json

app = FastAPI(title="datalens")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

DATAFRAME: Optional[pd.DataFrame] = None


def strip_accents(text: str) -> str:
    if not isinstance(text, str):
        text = str(text)
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def normalize_for_search(text: str) -> str:
    text = strip_accents(text).lower()
    text = re.sub(r"[\s\-]+", "", text)
    return text


def get_descripcion_col(df: pd.DataFrame) -> Optional[str]:
    for c in df.columns:
        if c.lower() == "descripcion":
            return c
    return None


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload/")
async def upload_csv(files: List[UploadFile] = File(...)):
    global DATAFRAME
    dataframes = []
    for file in files:
        filename = file.filename
        parts = filename.upper().replace(".CSV", "").split("_")
        proveedor = parts[1] if len(parts) > 1 else "DESCONOCIDO"

        df = pd.read_csv(file.file, on_bad_lines="skip")
        df.insert(0, "Proveedor", proveedor)
        dataframes.append(df)

    DATAFRAME = pd.concat(dataframes, ignore_index=True)
    return {"status": "ok", "rows": len(DATAFRAME), "columns": list(DATAFRAME.columns)}


@app.get("/clientes")
async def get_clientes(
    desc_regex: str = Query("", alias="desc_regex"),
):
    """
    Devuelve TODOS los clientes que coinciden con el filtro de texto,
    SIN excluir a los ya excluidos (el front los marcará como checked).
    """
    global DATAFRAME
    if DATAFRAME is None or "razonSocialCliente" not in DATAFRAME.columns:
        return {"clientes": []}

    df = DATAFRAME

    # Filtro por descripción (si existe la columna)
    if desc_regex:
        desc_col = get_descripcion_col(df)
        if desc_col:
            pattern = normalize_for_search(desc_regex)
            df = df[df[desc_col].astype(str).map(lambda v: pattern in normalize_for_search(v))]

    clientes_unicos = sorted(df["razonSocialCliente"].dropna().unique().tolist())
    return {"clientes": clientes_unicos}


@app.get("/data")
async def get_data(
    draw: int = 1,
    start: int = 0,
    length: int = 10,
    search: str = "",
    desc_regex: str = "",
    excluded_clients: str = "",
):
    global DATAFRAME
    if DATAFRAME is None:
        return JSONResponse(
            {"draw": draw, "recordsTotal": 0, "recordsFiltered": 0, "data": []}
        )

    df = DATAFRAME

    # Filtrado por descripción
    if desc_regex:
        desc_col = get_descripcion_col(df)
        if desc_col:
            pattern = normalize_for_search(desc_regex)
            df = df[df[desc_col].astype(str).map(lambda v: pattern in normalize_for_search(v))]

    # Exclusión de clientes
    if excluded_clients:
        try:
            clients_list = json.loads(excluded_clients)
            if isinstance(clients_list, list) and "razonSocialCliente" in df.columns:
                df = df[~df["razonSocialCliente"].isin(clients_list)]
        except Exception:
            pass

    total_records = len(DATAFRAME)
    filtered_records = len(df)

    data = df.iloc[start : start + length].fillna("").astype(str).values.tolist()

    return {
        "draw": draw,
        "recordsTotal": total_records,
        "recordsFiltered": filtered_records,
        "data": data,
    }


@app.post("/clear")
async def clear_data():
    global DATAFRAME
    if DATAFRAME is None:
        return {"status": "no_data"}
    DATAFRAME = None
    return {"status": "cleared"}
