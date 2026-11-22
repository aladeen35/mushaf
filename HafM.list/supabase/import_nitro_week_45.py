import json, re
data = open('/home/user/mushaf/HafM.list/assets/js/data.js').read()
by_code = {c: int(n) for n, c in re.findall(r'"no": (\d+),\s*"code": "([^"]*)"', data)}
Y, N = '✅', '❌'
# (line no, name as written, code or None, hibiscus, passion fruit, remark = the original text after the name)
L = [
 (1, 'Khuzam', 'B110', Y, Y, ''), (2, 'Al Falah', 'B90', N, N, ''), (3, 'Narjis', 'B19', Y, Y, ''), (4, 'King Fahad Metro', 'B104', N, N, ''),
 (6, 'Tahlia', 'B01', Y, Y, ''), (7, 'Mohamadiya', 'B08', Y, Y, ''), (8, 'Abha Soudha', 'B111', Y, Y, ''),
 (9, 'Makkah Crown Prince 1', 'B113', N, N, 'Iced Tea from gallon'), (10, 'Prince Sultan', 'B100', Y, Y, ''),
 (11, 'J Marwa', 'B57', N, N, 'Iced Tea not connected'), (12, 'Unaizah', 'B45', Y, Y, ''), (13, 'Al Kharj City', 'B61', Y, Y, ''),
 (14, 'Makkah Shouqiyah', 'B82', Y, Y, ''), (15, 'Abha Dabbab', 'B74', Y, Y, ''), (16, 'Inma Metro', 'B103', N, N, ''),
 (17, 'Makkah Saco', None, N, N, 'All connected with gallons'), (18, 'Rawabi', 'B20', N, N, 'Using Nitro'), (19, 'Shifa #1', 'B40', Y, Y, ''),
 (20, 'Khurais Riyadh', 'B65', Y, Y, 'Using Crathco'), (21, 'Compass', 'B92', N, N, 'Gallon'), (22, 'Makkah Mayan', None, Y, Y, ''),
 (23, 'Al Rawdah #2', None, Y, Y, ''), (24, 'Nuzha', None, N, N, 'Gallon – Passion Fruit had less foam'),
 (25, 'Al Ahsa 2 (Mubarraz)', 'B76', Y, Y, ''), (26, 'Sulaymaniyah', 'B49', Y, Y, ''), (27, 'WRR', 'B43', Y, N, 'Hibiscus ✅ / Passion Fruit ❌'),
 (28, 'Buraydah', 'B26', N, N, 'Direct Nitro'), (29, 'Abha Midmountain', 'B84', Y, N, 'Hibiscus ✅ / Passion Fruit ❌'), (30, 'Laban #1', 'B58', Y, Y, ''),
 (31, 'Al Ahsa 1 (Al Hofuf)', 'B53', Y, Y, ''), (32, 'Shubra', 'B25', Y, N, 'Hibiscus ✅ / Passion Fruit ❌ (From gallon)'),
 (33, 'Makkah Zaidi', 'B116', Y, Y, ''), (34, 'Makkah Crown Prince 2', 'B117', Y, Y, ''), (35, 'Taif City Walk', 'B36', N, N, 'All from gallons'),
 (36, 'Taif Jawharah', 'B91', Y, Y, ''), (37, 'Taif Shifa', 'B118', Y, Y, ''), (38, 'Rayyan Riyadh', 'B13', N, N, 'All from gallons'),
 (39, 'Farm', 'B105', Y, Y, ''), (40, 'Padel Up', 'B112', N, N, 'Hibiscus ❌ / Passion Fruit ❌'), (41, 'Qairawan', 'B39', N, N, 'Hibiscus ❌ / Passion Fruit ❌'),
 (42, 'Safa', 'B62', Y, N, 'Hibiscus ✅ (Crathco) / Passion Fruit ❌ (Gallon)'), (43, 'Atyaf Mall', None, Y, Y, ''),
 (44, 'Shifa #2', 'B52', N, N, 'Gallon'), (45, 'Maan Plaza', 'B48', Y, N, 'Hibiscus ✅ / Passion Fruit ❌'), (46, 'Aziziyah KBR', 'B50', Y, Y, ''),
 (47, 'STC', 'B122', N, N, 'Hibiscus ❌ / Passion Fruit ❌'), (48, 'Qasr Al Hukm', 'B102', N, N, ''),
 (49, 'Al Aziziyah Branch', 'B66', Y, N, 'Hibiscus ✅ / Passion Fruit ❌'), (50, 'Dammam Rawdah', 'B78', N, N, ''), (51, 'Tayyar Square', None, N, N, ''),
 (52, 'Laban #2', 'B88', Y, N, 'Hibiscus ✅ (Crathco) / Passion Fruit ❌ (Gallon)'), (53, 'Jizan Shatea', 'B67', Y, Y, ''),
 (54, 'Jizan Airport', 'B70', Y, N, 'Hibiscus ✅ / Passion Fruit ❌'), (55, 'Yasmin Riyadh Backyard', 'B04', Y, N, 'Hibiscus ✅ / Passion Fruit ❌'),
 (56, 'Asfan', 'B109', N, N, 'Iced Tea not connected'), (57, 'Qaraniya', 'B86', Y, Y, ''),
 (58, 'Sakaka', 'B108', N, None, 'Iced Tea ✅ (Connected to Nitro) / Hibiscus ❌'),
 (59, 'Tuwaiq', 'B80', Y, N, 'Hibiscus ✅ (Crathco) / Passion Fruit ❌ (Gallon)'), (60, 'Makkah haram', 'B99', Y, Y, ''),
 (61, 'Makkah Nawariyah', 'B124', Y, Y, ''), (62, 'Signature', 'B83', Y, Y, 'Not connected to Crathco but has a mini chiller for both mixes'),
 (64, 'Al Nadwah', 'B31', Y, Y, ''), (65, 'Yarmouk', 'B28', Y, Y, ''), (66, 'Anas', 'B32', Y, N, 'Hibiscus ✅ (PFT ❌)'), (67, 'IRQA', 'B30', N, N, ''),
 (68, 'King Faisal hospital', None, N, N, ''), (69, 'PNU', 'B101', N, N, ''), (70, 'Hail', 'B60', Y, Y, 'Iced tea direct from nitro'),
 (71, 'Tabouk seven', 'B120', N, N, 'Iced tea gallons'), (72, 'Tabouk bolyvard', 'B85', Y, Y, ''),
 (73, 'Najran king Saud', 'B95', Y, N, 'Hibiscus ✅ (Crathco) / Passion Fruit ❌ (Gallon)'), (74, 'Najran front', 'B96', Y, N, 'Hibiscus ✅ (Crathco) / Passion Fruit ❌ (Gallon)'),
 (75, 'Abha Talga', None, Y, Y, ''), (76, 'Tabouk ulya', 'B87', N, N, 'Iced tea in gallon'), (77, 'Nuzha', None, N, N, 'Both from nitro > gallon'),
 (78, 'Granada', 'B51', N, N, 'Both from nitro > gallon (also line 5: ❌)'), (79, 'Rimal 2', 'B114', N, N, 'Serving from gallon (Nitro) (also line 63: ❌)'),
 (80, 'Rimal 1', 'B94', N, N, 'Serving from gallon (Nitro)'),
]
rows, unmatched, seen = [], [], set()
for n, nm, code, h, p, rem in L:
    if code is None: unmatched.append(f'{n} - {nm}'); continue
    no = by_code[code]; assert no not in seen, (nm, code); seen.add(no)
    rows.append((no, {'hibiscus': h, 'passion-fruit': p}, (f'#{n} {nm}' + (f' — {rem}' if rem else ''))))
print(len(rows), 'branches | unmatched:', unmatched)
json.dump(rows, open('/tmp/claude-0/nitro_rows.json', 'w'), ensure_ascii=False)
