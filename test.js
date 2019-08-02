const sqlplus = require('./index.js');
var connProps = 'cwp_sys/cwp_sys@BAZA_DEV-DB';
var callback = function(err, data) {
	console.log('---------------------');
	if (err) {
		console.log(`SqlPlus command error! ${err}`)
	}
	else if (data) {
		console.log(`SqlPlus command success! Found ${data.length} results:`, data);
	}
};
sqlplus('select ID, CONTEXT_PATH from IFR where id < 10 order by id', connProps, callback, true);
console.log('\n\n =============================== \n\n');
sqlplus('select * from IFR where id = 0', connProps, callback, true);
console.log('\n\n =============================== \n\n');
sqlplus('select * from NON_EXISTENT_TABLE', connProps, callback, true);