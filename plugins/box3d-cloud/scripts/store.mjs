import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export function createStore(directory=process.env.BOX3D_CONNECTOR_HOME||path.join(os.homedir(),'.box3d-cloud')){
  const file=path.join(directory,'connection.json');
  return {directory,
    async read(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw Error('连接记录无法读取，请重新登录。');}},
    async write(value){
      await fs.mkdir(directory,{recursive:true,mode:0o700});
      if(process.platform==='win32')await run('icacls',[directory,'/inheritance:r','/grant:r',`${os.userInfo().username}:(OI)(CI)F`],{windowsHide:true});
      else await fs.chmod(directory,0o700);
      const temporary=path.join(directory,randomUUID()+'.tmp');
      try{await fs.writeFile(temporary,JSON.stringify(value),{mode:0o600,flag:'wx'});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}
    },
    async clear(){await fs.rm(file,{force:true});}
  };
}
