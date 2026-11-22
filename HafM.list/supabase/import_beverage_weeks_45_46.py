import json, re, openpyxl
U = '/root/.claude/uploads/081bb8f2-1c76-5669-821a-f24ec3a1ea32/'
data = open('/home/user/mushaf/HafM.list/assets/js/data.js').read()
B = re.findall(r'"no": (\d+),\s*"code": "([^"]*)",\s*"name": "([^"]*)"', data)
by_code = {c: int(n) for n, c, _ in B}
name_of = {int(n): nm for n, c, nm in B}
IDS = ['hibiscus', 'passion-fruit', 'matcha', 'hot-chocolate', 'espresso', 'ethiopian-drip-hot', 'ethiopian-drip-cold', 'brazil-hot', 'brazil-cold']
NORM = {'Okay': 'Okay', 'Not okay and fixed': 'Not okay and fixed', 'Not fixed': 'Not fixed', 'Not checked': 'Not checked ', 'Not checked ': 'Not checked ', 'not available': 'not available'}
def norm(v):
    if v is None: return None
    v = str(v)
    if v in NORM: return NORM[v]
    if v.strip() in NORM: return NORM[v.strip()]
    raise ValueError(v)

rows = []  # (week, branch_no, statuses, remarks)
# ---------- week 14-20 (codes) ----------
ws = openpyxl.load_workbook(U + 'f5bcef98-Beverage_Tasting_November_14-20_2026.xlsx').worksheets[0]
for r in range(5, 111):
    code = ws.cell(r, 2).value
    v = [norm(ws.cell(r, c).value) for c in range(5, 14)]
    rem = ws.cell(r, 19).value
    if not any(v) and not rem: continue
    rows.append(('2026-11-14', by_code[code], dict(zip(IDS, v)), (rem or '').strip()))
w1 = len(rows)

# ---------- week 7-13 (names only) ----------
M = {  # name in the file -> branch code (official list). None = not identifiable.
 'Almaseef': 'B35', 'Sulaymania': 'B49', 'AlTahlia': 'B01', 'AlMohammadiyyah': 'B08', 'King Fahad Metro': 'B104', 'Inma Bank Metro': 'B103',
 'Anas Rd.': 'B32', 'AlYasmin, Back Yard': 'B04', 'AlAqiq, alkhair': 'B44', 'Qasr Al-Hukm metro': 'B102', 'Irqah': 'B30', 'Padel Up': 'B112',
 'Al-Rajhi Bank': 'B05', 'SIB Bank': 'B11', 'KFR': 'B12', 'QAIRAWAN': 'B39', 'NARJIS': 'B19', 'KHUZAM VALLEY': 'B110', 'STC HQ': 'B122',
 'Laban، Najd St.': 'B58', 'Laban, Taif St.': 'B88', 'Maan Plaza': 'B48', 'Riy, AlAziziyah': 'B66', 'SHIFA-1': 'B40', 'SHIFA-2': 'B52',
 'SHUBRA': 'B25', 'DIRAB RD': 'B37', 'WRR': 'B43', 'TWAIQ': 'B80', 'ALDEERA': 'B106', 'RAYYAN': 'B13', 'SAFA': 'B62', 'RAWABI': 'B20',
 'NADWA': 'B31', 'QADISIYA': 'B38', 'King Faisal Dt': 'B54', 'COMPASS': 'B92', 'YARMOUK': 'B28', 'TRANSIT KHURAIS': 'B65', 'AL KHARJ CITY': 'B61',
 'AL KHARJ RD': 'B21', 'Burayda, AlRehab': 'B26', 'Unayzah': 'B45', 'Hail.': 'B60', 'Break Station.': 'B63', 'Buraidah Farm': 'B105',
 'Tabuk Boulevard': 'B85', 'Tabuk, Alulaya': 'B87', 'Sakaka, aljouf': 'B108', 'Tabuk-Seven': 'B120', 'Hafr albaten': 'B119', 'Riyadh,Signature': 'B83',
 'GRANADA': 'B51', 'AlMughrizat': 'B24', 'THUMAMAH,Qurtubah': 'B69', 'ALMUNISYA': 'B98', 'Riy PNU': 'B101', 'RIMAL#1': 'B94', 'RIMAL#2': 'B114',
 'JANADRIYAH': 'B107', 'TAAWUN': 'B59', 'FALAH': 'B90', 'Jazan, AlShatea': 'B67', 'Jazan, Airport.': 'B70', 'Abha, Al Dabab': 'B74',
 'Khamis Mushait.': None, 'Abha, Khamis Abha Rd.': 'B89', 'Abha, Talga': None, 'Najran King Saud': 'B95', 'Najran, Nahda': 'B96',
 'Abha soudah': 'B111', 'ABHA-7': 'B115', 'ABHA-SKY': None, 'KBR, Sea Front': 'B29', 'Dammam, AlShati': 'B47', 'KBR, AlAzizia': 'B50',
 'AlAhassa, AlHofuf': 'B53', 'AlAhssa, AlMubarraz': 'B76', 'Dammam, Al Rawdah': 'B78', 'MKH, AlAwali': 'B33', 'Taif, City Walk': 'B36',
 'AlMadeenah, AlAzizia.': 'B55', 'Medina Sultana': 'B71', 'MKH-AlSharae': 'B79', 'MKH-AlShawqiyah': 'B82', 'Madina Hijra': 'B77',
 'Taif, Aljawharah.': 'B91', 'MKH-Haram': 'B99', 'MKH-Wali Elahd#1': 'B113', 'MKH-Wali Elahd#2': 'B117', 'MKH-ZAIDI': 'B116', 'TAIF - SHIFA': 'B118',
 'Madina Haram': 'B121', 'J.AlKhaldia': 'B27', 'J.Basateen': 'B34', 'J.HAMDANIYAH': 'B64', 'J.Thaiba': 'B97', 'J.Prince Sultan': 'B100',
 'J.Naseem': 'B46', 'J.Rehab': 'B56', 'J.Marwah': 'B57', 'J.Qryniah': 'B86', 'J.Asfan': 'B109'}
ws = openpyxl.load_workbook(U + 'b9ce9b64-Beverage_Tasting_November_7-13_2026.xlsx').worksheets[0]
unmatched, seen = [], set()
for r in range(5, 108):
    nm = ws.cell(r, 2).value
    if nm is None: continue
    assert nm in M, nm
    v = [norm(ws.cell(r, c).value) for c in range(3, 12)]
    rem = ws.cell(r, 17).value
    if not any(v) and not rem: continue
    code = M[nm]
    if code is None: unmatched.append((nm, v)); continue
    no = by_code[code]; assert no not in seen, (nm, code); seen.add(no)
    rows.append(('2026-11-07', no, dict(zip(IDS, v)), (rem or '').strip()))
w2 = len(rows) - w1
print('week 14-20 rows', w1, '| week 7-13 rows', w2, '| unmatched 7-13:', [u[0] for u in unmatched])
# sanity: each 7-13 code lands on the name we expect
for nm, code in M.items():
    if code: print(f'  {nm:26s} -> {code:5s} {name_of[by_code[code]]}')
json.dump(rows, open('/tmp/claude-0/import_rows.json', 'w'))
json.dump(unmatched, open('/tmp/claude-0/import_unmatched.json', 'w'))
