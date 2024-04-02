## 放在entities/danmaku使用
import os
import re

source = "ball"
prefix = "danmaku_basic_"
save_path = "update"

danmaku_path = os.path.dirname(os.path.realpath(__file__))
def getPath(p):
    return danmaku_path+"\\"+p

if(os.path.exists(getPath(save_path))==False):
    os.makedirs(getPath(save_path))

file_list = os.listdir(danmaku_path)
with open(getPath(prefix+source+".json")) as template:
    t_str = template.read()
    for file in file_list:
        temp = re.findall(prefix + r"(\w+).json", file, re.DOTALL)
        if len(temp) == 0:
            continue
        id = temp[0]
        if id != "" and id != "2d" and id != "3d" and id != "manager":
            if os.path.isfile(getPath(file)):
                with open(getPath(file)) as f:
                    origin = f.read()
                    new = t_str.replace(source, id)
                    with open(getPath(save_path + "\\" + file), 'w', encoding='utf8') as f2:
                        f2.write(new)

