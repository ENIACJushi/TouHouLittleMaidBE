import os
import re
import json
import string
import shutil

# 手动指定
packName = "touhou_little_maid" # 模型包的命名空间
packIndex = 0 # 模型包的编号，一个世界的模型包编号不能出现重复

# 自动指定
sourceFolder = "source"
targetFolder = "target"


def json_from_file(path):
    if os.path.exists(path) and os.path.isfile(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            return None
    else:
        return None
    
# 移动文件夹
def folder_copy(source, target):
    shutil.copytree(source, target)

# 对路径下所有语言文件的key进行替换操作
def lang_replace(path, before, after):
    file_list = os.listdir(path)
    for file in file_list:
        file_path = path + "/" + file
        if os.path.isfile(file_path):
            origin = ""
            with open(file_path, 'r', encoding='utf8') as f:
                origin = f.read()
                f.close()
            with open(file_path, 'w', encoding='utf8') as f:
                new = origin.replace(before, after)
                f.write(new)
# 对路径下所有语言文件的key进行增加操作
def lang_add(path):
    print("[Lang] Add key:")

# 修改文件或路径下所有文件的模型格式
def process_model(path):
    if os.path.isfile(path):
        origin = ""
        with open(path, 'r', encoding='utf8') as f:
            origin = f.read()
            f.close()
        with open(path, 'w', encoding='utf8') as f:
            new = origin.replace("geometry.model", "geometry." + packName + "." + path.split('/')[-1].replace(".json", ""))
            f.write(new)
    else:
        model_list = os.listdir(path)
        for file in model_list:
            process_model(path + "/" + file)

def process():
    ##### 获取模型包信息 #####
    infos = json_from_file("source/maid_model.json")
    if(infos == None): 
        print("maid.model.json Not Exist")
        return
    target_model_others = targetFolder + "/models/entity/" + packName + "_others"
    target_model = targetFolder + "/models/entity/" + packName
    target_texture_others = targetFolder + "/textures/" + packName + "_others"
    target_texture = targetFolder + "/textures/" + packName
    target_lang = targetFolder + "/texts"

    ##### 移动文件 #####
    # 创建文件夹
    os.mkdir(targetFolder)
    # Lang 大写后两个字符，补充json文件
    folder_copy(sourceFolder + "/lang", target_lang)
    target_lang = target_lang
    for file in os.listdir(target_lang):
        if os.path.isfile(target_lang + "/" + file):
            new_name = file[0: 3] + file[3: 5].upper() + file[5:]
            os.rename(target_lang + "/" + file, target_lang + "/" + new_name)

    
    # Models 为每个包新建文件夹
    os.mkdir(targetFolder + "/models")
    os.mkdir(targetFolder + "/models/entity")
    os.mkdir(target_model)
    folder_copy(sourceFolder + "/models/entity", target_model_others)
    # Textures 为每个包新建文件夹
    os.mkdir(targetFolder + "/textures")
    os.mkdir(target_texture)
    os.mkdir(target_texture+"/entity")
    # os.mkdir(targetFolder + "/textures/" + packName)
    folder_copy(sourceFolder + "/textures", targetFolder + "/textures/" + packName + "_others")
    
    ##### 处理模型文件格式 #####
    model_path = targetFolder + "/models/entity/" + packName +"_others"
    model_list = os.listdir(model_path)
    process_model(model_path)

    ##### 生成 entity定义和render_controller #####
    os.mkdir(targetFolder + "/entity/")
    os.mkdir(targetFolder + "/render_controllers/")
    entity_path = targetFolder + "/entity/" + packName + "_maid.entity.json"
    render_path = targetFolder + "/render_controllers/" + packName + "_controller.json"
    shutil.copyfile("entity_template.entity.json", entity_path)
    shutil.copyfile("render_template.json", render_path)
    
    entity_file = open(entity_path, 'r', encoding='utf8')
    entity_def = entity_file.read()
    entity_file.close()
    entity_def = json.loads(entity_def)

    render_file = open(render_path, 'r', encoding='utf8')
    render_def = render_file.read()
    render_file.close()
    render_def = render_def.replace("<pack_name>", packName)
    render_def = render_def.replace("<index>", str(packIndex))
    render_def = json.loads(render_def)

    skin_index = 0
    # 添加render_controller
    controller_name = "controller.render.touhou_little_maid.maid_" + packName
    entity_def["minecraft:client_entity"]["description"]["render_controllers"].append(controller_name)
    for define in infos["model_list"]:
        # 添加模型
        model_key = packName + "_" + str(skin_index)
        model_id = "geometry." + define["model_id"].replace(":", ".")
        model_name = define["model_id"].split(":")[-1] # 模型名字
        if define.get("model"):
            model_id = "geometry." + define["model"].split(":")[0] + "." + define["model"].split("/")[-1].replace(".json", "")
        else:
            file_name = define["model_id"].split(":")[-1] + ".json"
            shutil.move(target_model_others + "/" + file_name, target_model + "/" + file_name)
        entity_def["minecraft:client_entity"]["description"]["geometry"][model_key] = model_id
        render_def["render_controllers"][controller_name]["arrays"]["geometries"]["Array.geos"].append("Geometry."+model_key)
        

        # 添加贴图
        texture_key = packName + "_" + str(skin_index)
        texture_path = "textures/" + packName + "/entity/" + define["model_id"].split(":")[-1]
        try:
            file_name = "textures/" + packName + "_others/entity/" + define["model_id"].split(":")[-1]
            shutil.move(targetFolder + "/" + file_name+".png", targetFolder + "/" + texture_path+".png")
        except:
            pass
        entity_def["minecraft:client_entity"]["description"]["textures"][texture_key]=texture_path
        render_def["render_controllers"][controller_name]["arrays"]["textures"]["Array.skins"].append("Texture."+texture_key)

        # 修改语言文件
        lang_replace(target_lang, model_name, str(skin_index))

        skin_index += 1

    with open(render_path, 'w', encoding='utf8') as f:
        f.write(json.dumps(render_def, indent=2))
    with open(entity_path, 'w', encoding='utf8') as f:
        f.write(json.dumps(entity_def, indent=2))
    print("生成完成，共" + str(skin_index) +"个模型")

    return
    ##### 处理模型包语言文件 #####
    # 模型包名称
    pack_name_target = "pack." + packName + ".maid.name" # 目标key
    pack_name = infos["pack_name"]
    if(pack_name != "{" + pack_name_target + "}"):
        lang_add(pack_name_target, pack_name) # 语言文件里没有模型包名称，额外追加
    # 模型包作者
    autor_names = ""
    for n in infos["author"]:
        autor_names += n
        autor_names += ","
    autor_names=autor_names[0:-1]
    print("autor_names: "+ autor_names)
    lang_add("pack." + packName + ".maid.author.names", autor_names)
    # 模型包描述
    pack_desc_target = "pack." + packName + ".maid.desc" # 目标key
    pack_desc = infos["description"]
    if(pack_name != "{" + pack_desc_target + "}"):
        lang_add(pack_desc_target, pack_desc) # 语言文件里没有模型包名称，额外追加

    

process()