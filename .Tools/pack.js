/**
 * 将json压缩并导出发布包
 */
const PATH_BP = "./TouhouLittleMaid_BP";

const AdmZip = require('adm-zip');
import * as fs from "fs"

// 要解压的ZIP文件路径
const zipFilePath = 'path/to/your/file.zip';
 
function zipBP(){
    // creating archives
    const zip = new AdmZip();
    
    let dir = fs.readdirSync(PATH_BP);
    dir.forEach((val)=>{
        
        val
    });
    
}
var AdmZip = require("adm-zip");





// reading archives
var zip = new AdmZip("./my_file.zip");
var password = "1234567890";
var zipEntries = zip.getEntries(); // an array of ZipEntry records - add password parameter if entries are password protected

zipEntries.forEach(function (zipEntry) {
    console.log(zipEntry.toString()); // outputs zip entries information
    if (zipEntry.entryName == "my_file.txt") {
        console.log(zipEntry.getData().toString("utf8"));
    }
});
// outputs the content of some_folder/my_file.txt
console.log(zip.readAsText("some_folder/my_file.txt"));
// extracts the specified file to the specified location
zip.extractEntryTo(/*entry name*/ "some_folder/my_file.txt", /*target path*/ "/home/me/tempfolder", /*maintainEntryPath*/ false, /*overwrite*/ true);
// extracts everything
zip.extractAllTo(/*target path*/ "/home/me/zipcontent/", /*overwrite*/ true);


// creating archives
var zip = new AdmZip();
// add file directly
var content = "inner content of the file";
zip.addFile("test.txt", Buffer.from(content, "utf8"), "entry comment goes here");
// add local file
zip.addLocalFile("/home/me/some_picture.png");
// get everything as a buffer
var willSendthis = zip.toBuffer();
// or write everything to disk
zip.writeZip(/*target file name*/ "/home/me/files.zip");
