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
        ws.send('');
    }, 1000*100);
}



function ParseStartCommander(json,ws)
{
    const json_player = json.player;
    const json_engine = json.engine;
    const json_token = json.token;
    const json_limit = json.limit;
    const json_projectAddress = json.projectAddress;
    const json_RenderOffScreen = json.RenderOffScreen;
    const json_Unattended = json.Unattended;
    const json_graphicsadapter= json.graphicsadapter;
    const json_ForceRes = json.ForceRes;
    const json_ResX = json.ResX;
    const json_ResY = json.ResY;
    const json_AudioMixer = json.AudioMixer;
    const json_PixelStreamingEncoderRateControl = json.PixelStreamingEncoderRateControl;
    //console.log(json_player);
    //console.log(json_engine);
    //console.log(json_token);
    //console.log(json_limit);
    //console.log(json_projectAddress);
    //console.log(json_RenderOffScreen);
    //console.log(json_Unattended);
    //console.log(json_graphicsadapter);
    //console.log(json_ForceRes);
    //console.log(json_ResX);
    //console.log(json_ResY);
    //console.log(json_AudioMixer);
    //console.log(json_PixelStreamingEncoderRateControl);
    StartUp(
        json_player,
        json_engine,
        json_token,
        json_limit,
        json_projectAddress,
        json_RenderOffScreen,
        json_Unattended,
        json_graphicsadapter,
        json_ForceRes,
        json_ResX,
        json_ResY,
        json_AudioMixer,
        json_PixelStreamingEncoderRateControl,
        ws
    )
}


function StartUp(player,engine,token,limit,projectAddress,RenderOffScreen,Unattended,graphicsadapter,ForceRes,ResX,ResY,AudioMixer,PixelStreamingEncoderRateControl,ws)
{
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
    /*
    const projectAddress_commander = querystring.stringify({
        projectAddress: projectAddress,
    }, ' ', '=');
    const RenderOffScreen_commander = querystring.stringify({
        RenderOffScreen: RenderOffScreen,
    }, ' ', '=');
    const graphicsadapter_commander = querystring.stringify({
        graphicsadapter: graphicsadapter,
    }, ' ', '=');
    const ForceRes_commander = querystring.stringify({
        ForceRes: ForceRes,
    }, ' ', '=');
    const ResX_commander = querystring.stringify({
        ResX: ResX,
    }, ' ', '=');
    const ResY_commander = querystring.stringify({
        ResY: ResY,
    }, ' ', '=');
    const AudioMixer_commander = querystring.stringify({
        AudioMixer: AudioMixer,
    }, ' ', '=');
    const PixelStreamingEncoderRateControl_commander = querystring.stringify({
        PixelStreamingEncoderRateControl: PixelStreamingEncoderRateControl,
    }, ' ', '=');
     */
    //启动信令的子进程
    const {spawn} = child_process;
    const child = spawn('node', ['signal-pro.js',player_commander,engine_commander,token_commander,limit_commander],
        { stdio: [null, null, null, 'ipc'] });
    process.stdin.pipe(child.stdin);

    child.stdout.on('data', (data) => {
        console.log(`child stdout: ${data}`);
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
        console.log(`child error: ${data}`);
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
    const StartUpUE = querystring.stringify({
        Unattended:'',
        RenderOffScreen:'',
        AudioMixer:'',
        graphicsadapter:graphicsadapter,
        ProjectID:"",
    }, ' ', '=');
    console.log(`StartUpUE: ${ StartUpUE}`);
    //启动ue进程
    const exec = require("child_process").exec;
    exec("start D:/ue4OutputPackage/Windows/MenZiQu.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8888 -graphicsadapter=0 -ProjectID=UE5", (error, stdout, stderr) => {})


    setInterval(function(){
        console.log(`signal child pid: ${ pixel_child_pid}`);
    }, 5000);

}
//var auth_signal = require("./signal-auth.js");