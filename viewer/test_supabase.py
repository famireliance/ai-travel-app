import requests

url = 'https://dxayqlfxyyvxazpyyehp.supabase.co/rest/v1/spots?prefecture=eq.東京都&select=address,description,name'
headers = {
    'apikey': 'sb_publishable_haXEdSy0CiWe6yKQokQsZA_W_DsCEzk',
    'Authorization': 'Bearer sb_publishable_haXEdSy0CiWe6yKQokQsZA_W_DsCEzk'
}
res = requests.get(url, headers=headers)
data = res.json()

for d in data:
    addr = d.get('address') or ''
    desc = d.get('description') or ''
    name = d.get('name') or ''
    if '豊島' in addr or '豊島' in desc or '豊島' in name or '池袋' in addr or '池袋' in desc or '池袋' in name:
        print(f"Name: {name}\nAddr: {addr}\nDesc: {desc}\n---")
