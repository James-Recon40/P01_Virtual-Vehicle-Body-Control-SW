#!/usr/bin/env python3
"""
extract_testcases.py - 05 BlackBox TestCase 엑셀에서 TC 행을 그대로 뽑아 static/testcases.json 으로 저장

UI의 TC 패널은 이 JSON의 문구(사전조건·절차·예상 결과)를 원문 그대로 보여 준다.
테스트케이스 문서가 바뀌면 다시 실행한다:  python3 web/tools/extract_testcases.py
외부 패키지 없이 표준 라이브러리(zipfile, xml)만 사용한다.
"""
import glob
import json
import os
import sys
import xml.etree.ElementTree as ET
import zipfile

WEB_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(WEB_DIR)
OUT_PATH = os.path.join(WEB_DIR, "static", "testcases.json")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
T = "{%s}t" % NS["m"]

# 05 문서 헤더 이름 → JSON 키
COLUMNS = {"TC ID": "id", "요구사항 ID": "req", "테스트 기법": "technique", "테스트 목적": "purpose",
           "사전조건": "precondition", "입력": "input", "테스트 절차": "procedure", "예상 결과": "expected",
           "비고": "note"}


def col_index(ref):
    n = 0
    for ch in ref:
        if ch.isalpha():
            n = n * 26 + ord(ch.upper()) - 64
        else:
            break
    return n - 1


def read_sheets(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter(T)))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    for sheet in wb.find("m:sheets", NS):
        target = rels[sheet.get("{%s}id" % NS["r"])].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        rows = []
        for row in ET.fromstring(z.read(target)).iter("{%s}row" % NS["m"]):
            cells = {}
            for c in row.findall("m:c", NS):
                v = c.find("m:v", NS)
                if c.get("t") == "s" and v is not None:
                    text = shared[int(v.text)]
                elif c.get("t") == "inlineStr":
                    text = "".join(t.text or "" for t in c.iter(T))
                else:
                    text = v.text if v is not None else ""
                cells[col_index(c.get("r"))] = text.strip()
            rows.append(cells)
        yield sheet.get("name"), rows


def main():
    files = sorted(glob.glob(os.path.join(ROOT_DIR, "tests", "test_cases", "*.xlsx")))
    if not files:
        sys.exit("tests/test_cases/ 에 xlsx 파일이 없습니다.")
    source = files[-1]
    cases = []
    for sheet, rows in read_sheets(source):
        header = None
        for cells in rows:
            if header is None:
                if "TC ID" in cells.values():
                    header = {i: COLUMNS[v] for i, v in cells.items() if v in COLUMNS}
                continue
            tc_id = cells.get(next(i for i, k in header.items() if k == "id"), "")
            if not tc_id.startswith("TC-"):
                continue
            item = {"sheet": sheet}
            item.update({key: cells.get(i, "") for i, key in header.items()})
            cases.append(item)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"source": os.path.basename(source), "cases": cases}, f, ensure_ascii=False, indent=1)
    print(f"{len(cases)}개 TC → {os.path.relpath(OUT_PATH, ROOT_DIR)} ({os.path.basename(source)})")


if __name__ == "__main__":
    main()
