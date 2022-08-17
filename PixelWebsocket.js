//require("./systemIO.js");
const WebSocket = require("ws");
const child_process = require("child_process");
const querystring = require('querystring');
require('fs');
let limitConnect = 10;  // 断线重连次数
let timeConnect = 5;
webSocketInit("ws://localhost:8765");
const pixel_child_pid = new Array();
let connect_state = false;


//socket初始化
function webSocketInit(service){
    const ws = new WebSocket(service);
    ws.onopen = function () {
        console.log("已连接中心机服务器");
        connect_state = true;
        ws.send("connect to center")
    };
    ws.on("message", function(data) {
        //console.log(data);//原始打印
        //console.log(data.toString('utf8'));//utf8打印
        data = JSON.parse(data);
        ParseStartCommander(data,ws);
    });
    ws.onclose = function () {
        connect_state = false;
        console.log('服务器已经断开');
        reconnect(service);
    };

    // 重连
    function reconnect(service) {
        // lockReconnect加锁，防止onclose、onerror两次重连
        if(limitConnect>0){
            limitConnect --;
            timeConnect ++;
            console.log("第"+timeConnect+"次重连");
            // 进行重连
            setTimeout(function(){
                webSocketInit(service);
            },2000);

        }else{
            console.log("中心机连接已超时");
        }
    }

    // 心跳 * 回应
    setInterval(function(){
        //ws.send('');
    }, 1000*100);
}



function ParseStartCommander(json,ws)
{
    const json_player = json.player;
    const json_engine = json.engine;
    const json_token = json.token;
    const json_limit = json.limit;
    const json_projectAddress = json.projectAddress;
    const json_graphicsadapter= json.graphicsadapter;
    const json_ForceRes = json.ForceRes;
    const json_ResX = json.ResX;
    const json_ResY = json.ResY;
    const json_AudioMixer = json.AudioMixer;
    const json_PixelStreamingEncoderRateControl = json.PixelStreamingEncoderRateControl;
    const json_ProjectID = json.ProjectID;
    StartUp(
        json_player,
        json_engine,
        json_token,
        json_limit,
        json_projectAddress,
        json_graphicsadapter,
        json_ForceRes,
        json_ResX,
        json_ResY,
        json_AudioMixer,
        json_PixelStreamingEncoderRateControl,
        json_ProjectID,
        ws
    )
}


function StartUp(player,engine,token,limit,projectAddress,graphicsadapter,ForceRes,ResX,ResY,AudioMixer,PixelStreamingEncoderRateControl,ProjectID,ws)
{
    if (player==undefined&&engine==undefined)
    {
        console.log('一般模式api启动');
        const port =require('./GetFreePort');
        player = port.port();
        //console.log(`player_commander: ${player}`);
        engine = port.port();
        //console.log(`engine_commander: ${engine}`);
    }
    const player_commander = querystring.stringify({
        player: player,
    }, ' ', '=');
    const engine_commander = querystring.stringify({
        engine: engine,
    }, ' ', '=');
    const token_commander = querystring.stringify({
        token: token,
    }, ' ', '=');
    const limit_commander = querystring.stringify({
        limit: limit,
    }, ' ', '=');
    //启动信令的子进程
    const exec = require("child_process").exec;
    /*
    let signal_start_up = 'signal-pro.js '+'--name '+ProjectID +' --'+' '+player_commander+' '+engine_commander+' '+token_commander+' '+limit_commander;
    //console.log('signal_start_up: ' + signal_start_up);

    const child = exec('pm2 start '+signal_start_up,
        function (error, stdout, stderr) {
            process.stdin.pipe(child.stdin);
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log('exec error: ' + error);
            }
        });
     */

    const {spawn} = child_process;
    const child = spawn('node', ['signal-pro.js',player_commander,engine_commander,token_commander,limit_commander],
        { stdio: [null, null, null, 'ipc'] });
    process.stdin.pipe(child.stdin);

    child.stdout.on('data', (data) => {
        console.log('child pid:'+ child.pid+ ' child stdout:'+ data);
        let bfound = false;
        for (let i = 0; i < pixel_child_pid.length; i++) {
            if (pixel_child_pid[i] == child.pid) {
                bfound = true;
            }
        }
        if (!bfound)
            pixel_child_pid.push(child.pid);
        //ws.send('信令服务创建成功');
    });

    child.stderr.on('data',(data) => {
        console.log(`child error: ${child.pid,data}`);
        //ws.send('信令服务创建失败，原因端口占用');
    });

    child.on('exit', function (code) {
        console.log(`子进程已退出退出码: ${code}`);
        console.log(`子进程已退出进程号: ${child.pid}`);
        for (let i=0; i<pixel_child_pid.length; i++)
        {
            if(pixel_child_pid[i] == child.pid){
                //删除值
                pixel_child_pid.splice(i,1);
                //下标递减
                i--;
            }

        }
    });

    const UEStratUpPort = ' -PixelStreamingURL=ws://127.0.0.1:'+ engine;
    const StartUpUEFirstPart = projectAddress +UEStratUpPort+' -Unattended -RenderOffScreen -ForceRes -'
    const StartUpUELastPart = querystring.stringify({
        ResX,
        ResY,
        AudioMixer,
        graphicsadapter,
        PixelStreamingEncoderRateControl,
        ProjectID,
    }, ' -', '');
    //console.log(`StartUpUEFirstPart: ${ StartUpUEFirstPart}`);
    //console.log(`StartUpUELastPart: ${ StartUpUELastPart}`);
    const StartUp = StartUpUEFirstPart+StartUpUELastPart;
    console.log(`StartUp: ${ StartUp}`);
    //启动ue进程
    exec("start "+StartUp, (error, stdout, stderr) => {})


    setInterval(function(){
        console.log('当前子存活子进程projectID:'+ProjectID+' 当前子存活子进程pid:' + pixel_child_pid);
    }, 5000);

}
//var auth_signal = require("./signal-auth.js");