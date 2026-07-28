with open('C:/bitrix/server.js', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix specific replacements that broke the code
c = c.replace("title: subject || 'ЗАКАЗ ? ' + companyName", "title: subject || 'Визит к ' + companyName")
c = c.replace("description: 'ЗАМЕТКА ЗАМЕТКА\\n'", "description: 'Автоматически создано\\n'")
c = c.replace("'**ЗАКАЗ:**", "'**Итого:**")
c = c.replace("title: 'ЗАКАЗ ('", "title: 'Заказ ('")
c = c.replace("|| 'ЗАМЕТКА')", "|| 'Компания')")
c = c.replace("companyName = 'ЗАМЕТКА '", "companyName = 'Компания '")

with open('C:/bitrix/server.js', 'w', encoding='utf-8') as f:
    f.write(c)

print('Fixed!')
