const app = new Vue({
  el: '#app',
  data: {
    devices: [],
    lastUpdate: new Date().toLocaleString(),
    loading: true,
    showModal: false // Propriedade para controlar visibilidade do modal
  },
  created() {
    this.fetchDevicesData();

    setInterval(() => {
      this.fetchDevicesData();
    }, 20000);
  },
  methods: {
    blinkClass(status) {
      return status === 'Offline' ? 'blink' : '';
    },

    fetchDevicesData() {
      axios.get('assets/php/devices.php')
        .then(response => {
          this.devices = response.data;
          this.lastUpdate = new Date().toLocaleString();
          this.loading = false; // Altera o estado para loaded
        })
        .catch(error => {
          console.log(error);
          this.loading = false; // Altera o estado para loaded mesmo em caso de erro
        });
    }
  }
});
