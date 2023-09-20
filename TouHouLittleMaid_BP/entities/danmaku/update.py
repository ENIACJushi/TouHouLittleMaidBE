import os
import re

source = "ball"
prefix = "danmaku_basic_"
save_path = "update"

if(os.path.exists(save_path)==False):
    os.makedirs(save_path)

danmaku_path = os.path.dirname(os.path.realpath(__file__))
file_list = os.listdir(danmaku_path)
with open(prefix+source+".json") as template:
    t_str = template.read()
    for file in file_list:
        temp = re.findall(prefix + r"(\w+).json", file, re.DOTALL)
        if len(temp) == 0:
            continue
        id = temp[0]
        if id != "" and id != "2d" and id != "3d" and id != "manager":
            if os.path.isfile(file):
                with open(file) as f:
                    origin = f.read()
                    new = t_str.replace("source", id)
                    with open(save_path + "/" + file, 'w', encoding='utf8') as f2:
                        f2.write(new)
