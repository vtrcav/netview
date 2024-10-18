<?php

$devices = array(
    'MIKROTIK' => array('ip' => '172.17.29.1', '24h' => true),
    'CIL' => array('ip' => '172.17.29.2', '24h' => true),
    'AD' => array('ip' => '172.17.29.3', '24h' => true),
    'HINFO' => array('ip' => '172.17.29.4', '24h' => true),
    'PORTAIS' => array('ip' => '172.17.29.5', '24h' => true),
    'GLPI' => array('ip' => '172.17.29.10', '24h' => true),
    'RELOGIO' => array('ip' => '172.17.29.200', '24h' => true),
    'DVRADM' => array('ip' => '172.17.29.41', '24h' => true),
    'DVR1NUT' => array('ip' => '172.17.29.16', '24h' => true),
    'DVR2NUT' => array('ip' => '172.17.29.17', '24h' => true),
    'DVRCM' => array('ip' => '172.17.29.12', '24h' => true),
    'DVRSPA' => array('ip' => '172.17.29.13', '24h' => true),
    'DVR1AMB' => array('ip' => '172.17.29.14', '24h' => true),
    'DVR2AMB' => array('ip' => '172.17.29.15', '24h' => true),
    'IMPECP' => array('ip' => '172.17.29.18', '24h' => true),
    'IMPNUT' => array('ip' => '172.17.29.28', '24h' => true),
    'IMPCAF' => array('ip' => '172.17.29.33', '24h' => false),
    'IMPPRE' => array('ip' => '172.17.29.45', '24h' => false),
    'IMPADM' => array('ip' => '172.17.29.25', '24h' => true),
    'IMPNAS' => array('ip' => '172.17.29.29', '24h' => false),
    'IMPARQ' => array('ip' => '172.17.29.46', '24h' => false),
    'IMPAGE' => array('ip' => '172.17.29.24', '24h' => false),
    'IMPCM' => array('ip' => '172.17.29.175', '24h' => true),
    'IMPFAT' => array('ip' => '172.17.29.177', '24h' => false),
    'IMPCLR' => array('ip' => '172.17.29.178', '24h' => true),
    'IMPRH' => array('ip' => '172.17.29.21', '24h' => false),
    'IMPCONS' => array('ip' => '172.17.29.31', '24h' => true),
    'IMPPOS' => array('ip' => '172.17.29.27', '24h' => true),
    'ROTDIR' => array('ip' => '172.17.29.19', '24h' => true),
    'ROTAGE' => array('ip' => '172.17.29.20', '24h' => true),
    'ROTCON' => array('ip' => '172.17.29.34', '24h' => true),
    'ROTPER' => array('ip' => '172.17.29.40', '24h' => true),
    'ROTCOR' => array('ip' => '172.17.29.44', '24h' => true),
    'ROTNUT' => array('ip' => '172.17.29.42', '24h' => true),
    'ROTAGE' => array('ip' => '172.17.29.20', '24h' => true),
    'ROTJUR' => array('ip' => '172.17.29.90', '24h' => true),
    'ROTFAR' => array('ip' => '172.17.29.47', '24h' => false),
    'ROTCM' => array('ip' => '172.17.29.30', '24h' => true),
    'ROTMAN' => array('ip' => '172.17.29.50', '24h' => true),
    'ROTRH' => array('ip' => '172.17.29.51', '24h' => true),
    'ROTECP' => array('ip' => '172.17.29.100', '24h' => true),
    'PROINDDY 1' => array('ip' => 'srvproinddy.ddns.net', '24h' => true),
    'PROINDDY 2' => array('ip' => 'srvproinddy.ddns.me', '24h' => true),
    'IMPRE - MANUTENÇÃO' => array('ip' => '172.17.29.32', '24h' => true)
     	
);

$results = array(); // Array para armazenar os resultados dos pings

foreach ($devices as $name => $device) {
    $result = array();
    $result['name'] = $name; // Armazena o nome do dispositivo no resultado
    $result['ip'] = $device['ip']; // Armazena o endereço IP do dispositivo no resultado

    // Verifica se o horário está dentro do intervalo de funcionamento e se é um dia útil, ou se o dispositivo deve ser monitorado 24h
    $current_hour = date('G');
    $is_weekday = date('N') <= 5;

    if (($current_hour >= 7 && $current_hour < 18) && $is_weekday || $device['24h'] ) {
        $command = "ping -n 1 -w 1 " . $device['ip']; // Define o comando ICMP para enviar ao IP

        exec($command, $output, $status); // Executa o comando ICMP e armazena o status de retorno

        if ($status === 0) {
            $result['status'] = 'Online'; // Se o status de retorno for 0, o dispositivo está online
        } else {
            $result['status'] = 'Offline'; // Se o status de retorno for diferente de 0, o dispositivo está offline
            // Enviar notificação via WhatsApp ou outro meio
        }
    } else {
        $result['status'] = 'Fora de horário'; // Define o status como fora de horário se estiver fora do intervalo de funcionamento
    }

    $results[] = $result; // Adiciona o resultado ao array de resultados
}

header('Content-Type: application/json'); // Define o tipo de conteúdo da resposta como JSON
echo json_encode($results); // Exibe os resultados dos pings como JSON
