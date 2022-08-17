const { execSync } = require('child_process')
const os = require('os')


function getIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
}

//console.log(getIPAddress())


// 根据最大值和最小值随机取一个出来
const randomNum = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min

const getFreePort = (minPort = 1000, maxPorts = 8888) => {
    const port = randomNum(minPort, maxPorts)
    if (port.length === 0) {
        console.info('分配端口已达最大限额')
        return null
    }

    let stdout = null

    try {
        if (os.type() === 'Windows_NT') {
            //windows
        } else if (os.type() === 'Darwin') {
            //mac
            stdout = execSync(`lsof -i:${port}`)
        } else if (os.type() === 'Linux') {
            //Linux
            stdout = execSync(`netstat -anp | grep ${port}`)
        }
        if (!stdout) {
            return port
        } else {
            return getFreePort()
        }
    } catch (e) {
        return port
    }
}

exports.port = getPort;
function getPort()
{
    return getFreePort();
}

console.log(getPort())
console.log(getPort())
