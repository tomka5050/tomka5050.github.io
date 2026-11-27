#!/usr/bin/env python3
"""Diagnosztikus export elemzés a nyilvánosan NEM tárolt javítókulccsal."""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

def main():
    if len(sys.argv) != 4:
        sys.exit("Használat: python analyze.py export.json PRIVAT-answer-key.json report.csv")
    data=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data=[data]
    key=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    if any(not isinstance(x, dict) for x in data):
        sys.exit("Az exportnak kitöltésobjektumokat kell tartalmaznia.")
    rows=[]
    for attempt in data:
        by_topic=defaultdict(lambda:{"correct":0,"tested":0,"skipped":0,"open":0,"low_confidence":0})
        for a in attempt.get("answers",[]):
            qid=a.get("questionId"); topic=a.get("topicId","ismeretlen")
            g=by_topic[topic]; ans=str(a.get("answer","")).strip()
            if int(a.get("confidence",0))<=1: g["low_confidence"]+=1
            expected=key.get(qid)
            if expected is None:
                g["open"]+=1
            else:
                g["tested"]+=1
                if ans.upper()==str(expected).upper():g["correct"]+=1
                if ans=="" or ans=="?":g["skipped"]+=1
        for topic,g in sorted(by_topic.items()):
            rows.append({"studentCode":attempt.get("studentCode",""),"testId":attempt.get("testId",""),"topic":topic,
                **g,"mc_percentage":round(100*g["correct"]/g["tested"],1) if g["tested"] else None})
    path=Path(sys.argv[3])
    fields=["studentCode","testId","topic","correct","tested","skipped","open","low_confidence","mc_percentage"]
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    print(f"{len(rows)} témaköri összesítés készült: {path.resolve()}")
    print("FIGYELEM: a 6 szöveges válasz további emberi/AI-értékelést igényel.")
if __name__=="__main__":
    main()
