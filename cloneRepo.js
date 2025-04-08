
import readline from 'readline';
import { exec } from 'child_process';
import chalk from 'chalk';


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(chalk.yellow('Welcome to Website Screenshot Tool'));
function cloneRepo() {
    return new Promise((resolve, reject) => {
        rl.question('Enter GitHub repository URL: ', (url) => {
            console.log(chalk.blue(`Cloning repository: ${url}`));
            exec(`git clone ${url} repo`, (error, stdout, stderr) => {
                if (error) {
                    console.error(chalk.red(`Clone Error: ${error.message}`));
                    rl.close();
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.log(chalk.blue(`Clone Output: ${stderr}`));
                }
                console.log(chalk.green('Repository cloned successfully'));
                rl.close();
                resolve();
            });
        });
    });
}
export default cloneRepo;