const sqlplus = require('./index.js');
var sql = 'select ID, NAME from CHAM_LAYER where ifr_id = 198';
var connProps = 'cwp_sys/cwp_sys@' + process.env.TNS_NAME;
var callback = function(err, data) {
	console.log(`Found ${data.length} results:`, data);
};
sqlplus(sql, connProps, callback, true);