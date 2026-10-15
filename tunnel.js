import localtunnel from 'localtunnel';

async function start() {
  try {
    const tunnel = await localtunnel({ port: 5173 });
    console.log(`\n========================================`);
    console.log(`ONLINE LIVE PUBLIC URL: ${tunnel.url}`);
    console.log(`========================================\n`);

    tunnel.on('close', () => {
      console.log('Tunnel was closed. Reconnecting...');
      setTimeout(start, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to create tunnel:', err);
    setTimeout(start, 5000);
  }
}

start();
