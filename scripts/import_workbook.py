"""Import editable workbook inputs with foreign-key and stale-copy checks."""
import argparse
import hashlib
import json
import os
import tempfile
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'data/catalog.json'
BASELINE = ROOT / '.local/workbook_baseline.sha256'
SCHEMA = {
    'events': ('共享事件', ['id','title','year','quarter','date','period','status','region','category','fact','published','source','url']),
    'impacts': ('品种影响', ['id','event_id','commodity','region','module','factor','impact','metric','condition','window']),
    'factors': ('电力研究维度', ['id','module','factor','region','metrics','mechanism','season','boundary','source']),
    'relations': ('品种联动', ['id','from','to','type','path','metric','boundary']),
}


def normalize(value):
    if isinstance(value, (date, datetime)):
        return value.strftime('%Y-%m-%d')
    return '' if value is None else value


def validate(data):
    for key, (_, columns) in SCHEMA.items():
        ids = [r['id'] for r in data[key]]
        if len(ids) != len(set(ids)):
            raise ValueError(f'{key}: ID重复')
        for row in data[key]:
            if not str(row['id']).strip():
                raise ValueError(f'{key}: 缺少ID')
            for value in row.values():
                if isinstance(value, str) and value.startswith('='):
                    raise ValueError(f'{row["id"]}: 输入列含公式，请改为明确值')
    event_ids = {r['id'] for r in data['events']}
    for e in data['events']:
        if not isinstance(e['year'], (int, float)) or int(e['year']) != e['year'] or not 1900 <= e['year'] <= 2200:
            raise ValueError(f'{e["id"]}: 年份无效')
        if e['quarter'] not in (0, 1, 2, 3, 4):
            raise ValueError(f'{e["id"]}: 季度须为0至4，0表示年内待定')
        if e['status'] not in ('已发生', '计划', '预测', '线索'):
            raise ValueError(f'{e["id"]}: 事件状态无效')
        if not e['title'] or not e['fact'] or not e['period'] or not e['source']:
            raise ValueError(f'{e["id"]}: 事件、事实、时间窗口或来源缺失')
        if e['date']:
            d = date.fromisoformat(str(e['date']))
            if d.year != e['year'] or (d.month - 1) // 3 + 1 != e['quarter']:
                raise ValueError(f'{e["id"]}: 日期与年季度不一致')
    for r in data['impacts']:
        if r['event_id'] not in event_ids:
            raise ValueError(f'{r["id"]}: 事件ID不存在 {r["event_id"]}')
        if not all(r[k] for k in ['commodity','region','module','impact','condition']):
            raise ValueError(f'{r["id"]}: 品种、地区、模块、判断或条件缺失')


def read_workbook(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=False)
    data = {}
    for key, (sheet_name, fields) in SCHEMA.items():
        sheet = workbook[sheet_name]
        rows = []
        for values in sheet.iter_rows(min_row=2, max_col=len(fields), values_only=True):
            if not any(v is not None and v != '' for v in values):
                continue
            if values[0] in (None, ''):
                raise ValueError(f'{sheet_name}: 存在已填写但没有ID的行')
            rows.append(dict(zip(fields, map(normalize, values))))
        data[key] = rows
    workbook.close()
    validate(data)
    return data


def digest(data):
    raw = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix='.import-', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
            stream.write(content)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--check', action='store_true', help='校验并在内容一致时建立编辑基线')
    args = parser.parse_args()
    incoming = read_workbook(args.workbook)
    current = json.loads(CATALOG.read_text(encoding='utf-8'))
    validate(current)
    current_hash = digest(current)
    incoming_hash = digest(incoming)
    if args.check:
        if incoming_hash != current_hash:
            raise ValueError('Excel与结构化数据内容不同；请先核对差异，不建立基线')
        atomic_write(BASELINE, current_hash + '\n')
        print('输入页、ID、时间和关联校验通过；内容一致，已建立编辑基线')
        return
    if not BASELINE.exists() or BASELINE.read_text().strip() != current_hash:
        raise ValueError('缺少基线或结构化数据已更新；停止导入，避免旧Excel覆盖新内容')
    if incoming_hash == current_hash:
        print('内容未变化')
        return
    atomic_write(CATALOG, json.dumps(incoming, ensure_ascii=False, indent=2) + '\n')
    atomic_write(BASELINE, incoming_hash + '\n')
    print('已导入：' + '、'.join(f'{key} {len(rows)}条' for key, rows in incoming.items()))


if __name__ == '__main__':
    main()
