from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import List
import pandas as pd

app = FastAPI(title="datalens")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

DATAFRAME = None


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload/")
async def upload_csv(files: List[UploadFile] = File(...)):
    global DATAFRAME
    dataframes = []
    for file in files:
        df = pd.read_csv(file.file, on_bad_lines='skip')
        dataframes.append(df)
    DATAFRAME = pd.concat(dataframes, ignore_index=True)
    return {"status": "ok", "rows": len(DATAFRAME), "columns": list(DATAFRAME.columns)}


@app.get("/data")
async def get_data(draw: int = 1, start: int = 0, length: int = 10, search: str = ""):
    global DATAFRAME
    if DATAFRAME is None:
        return JSONResponse(
            {"draw": draw, "recordsTotal": 0, "recordsFiltered": 0, "data": []}
        )

    df = DATAFRAME

    # Filtro por texto
    if search:
        mask = df.apply(
            lambda row: row.astype(str).str.contains(search, case=False).any(), axis=1
        )
        df = df[mask]

    total_records = len(DATAFRAME)
    filtered_records = len(df)

    data = df.iloc[start : start + length].fillna("").astype(str).values.tolist()

    return {
        "draw": draw,
        "recordsTotal": total_records,
        "recordsFiltered": filtered_records,
        "data": data,
    }
