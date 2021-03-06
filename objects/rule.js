var Client = require('node-rest-client').Client;
var colors = require('colors');
var _ = require('underscore');
var Table = require('easy-table');
var fs = require('fs');
var context = require('./context.js');
var login = require('../util/login.js');
var printObject = require('../util/printObject.js');
var dotfile = require('../util/dotfile.js');

module.exports = {
	doRule: function(action, cmd) {
		if (action === 'list') {
			module.exports.list(cmd);
		}
		else if (action === 'create') {
			module.exports.create(cmd);
		}
		else if (action === 'export') {
			module.exports.export(cmd);
		}
		else if (action === 'import') {
			module.exports.import(cmd);
		}
		else if (action === 'delete') {
			module.exports.del(cmd);
		}
		else {
			console.log('You must specify an action: list, create, import, export, update or delete');
			//program.help();
		}
	},
	
	list: function (cmd) {
		var client = new Client();
		
		var loginInfo = login.login(cmd);
		if ( ! loginInfo)
			return;
		var url = loginInfo.url;
		var apiKey = loginInfo.apiKey;
		
		var projIdent = cmd.project_ident;
		if ( ! projIdent) {
			projIdent = dotfile.getCurrentProject();
			if ( ! projIdent) {
				console.log('There is no current project.'.yellow);
				return;
			}
		}

		client.get(url + "/rules?sysfilter=equal(project_ident:" + projIdent +")&pagesize=100&sysorder=(name:asc)", {
			headers: {
				Authorization: "CALiveAPICreator " + apiKey + ":1",
				"Content-Type" : "application/json"
			}
		}, function(data) {
			if (data.errorMessage) {
				console.log(data.errorMessage.red);
				return;
			}
			printObject.printHeader('Rules');
			var table = new Table();
			var adminCmd = "";
			var tblWidth = 0;
			var typeWidth = 0;
			_.each(data, function(p) {
				table.cell("Ident", p.ident);
				table.cell("Name", p.name);
				table.cell("Table", p.entity_name);
				if(p.attribute_name) {
					table.cell("Attr",p.attribute_name);
				} else {
					table.cell("Attr","");
				}
				//console.log("Entity Name "+p.entity_name);
				tblWidth = (p.entity_name && p.entity_name.length > tblWidth) ? p.entity_name.length : tblWidth;
				var type = module.exports.getRuleType(p.ruletype_ident);
                table.cell("Type", type);
				adminCmd += module.exports.show(p);
				typeWidth = type.length > typeWidth ? type.length : typeWidth;
				
				var maxWidth = printObject.getScreenWidth() - (tblWidth + typeWidth + 11+ 2);
				var maxColWidth = (maxWidth / 3) - 3;


				var autoName = p.title;
				if (autoName && autoName.length > maxColWidth) {
					autoName = autoName.substring(0, (maxColWidth - 3)) + "...";
					table.cell("Title", autoName.replace(/\n/g, ''));
				} else {
                    table.cell("Title","");
				}
				var comments = p.comments;
				if (comments) {
					comments = comments.replace(/\n/g, '');
				}
				if ( ! comments) {
					comments = "";
				}
				else if (comments.length > maxColWidth){
					comments = comments.substring(0, (maxColWidth - 3)) + "...";
				}
				table.cell("Comments", comments);
				table.newRow();
			});
			if (data.length === 0) {
				console.log('There is no rule defined for this project'.yellow);
			}
			else {
				table.sort(['Table', 'Type', 'Description']);
				console.log(table.toString());
				if (cmd.verbose){ console.log(adminCmd) };
			}
			printObject.printHeader("# rules: " + data.length);
		});
	},
	
	create: function(cmd) {
		var client = new Client();
		var loginInfo = login.login(cmd);
		if ( ! loginInfo)
			return;
		if ( ! cmd.ruletype) {
			console.log('Missing parameter: ruletype'.red);
			return;
		}
		cmd.ruletype = cmd.ruletype.toLowerCase();
		switch(cmd.ruletype) {
			case 'sum': cmd.ruletype = 1; break;
			case 'count': cmd.ruletype = 2; break;
			case 'formula': cmd.ruletype = 3; break;
			case 'parentcopy': cmd.ruletype = 4; break;
			case 'validation': cmd.ruletype = 5; break;
			case 'commitvalidation': cmd.ruletype = 6; break;
			case 'event': cmd.ruletype = 7; break;
			case 'earlyevent': cmd.ruletype = 8; break;
			case 'commitevent': cmd.ruletype = 9; break;
			case 'minimum': cmd.ruletype = 11; break;
			case 'maximum': cmd.ruletype = 12; break;
			case 'managedparent': cmd.ruletype = 13; break;
			case 'pre-insert': cmd.ruletype = 10; break;
			default: console.log('Invalid rule type'.red); return;
		}
		if ( ! cmd.entity_name) {
			console.log('Missing parameter: entity_name'.red);
			return;
		}
		if ( ! cmd.entity_name.match(/\w+:\w+/)) {
			console.log('Parameter entity_name must have the format prefix:table'.red);
			return;
		}
		if (cmd.active) {
			cmd.active = (cmd.active.toLowerCase() === 'true');
		}
		else {
			cmd.active = true;
		}

		if ( ! cmd.attribute_name && (cmd.ruletype==1 || cmd.ruletype==2 || cmd.ruletype==3 || cmd.ruletype==4 || 
				cmd.ruletype==11 || cmd.ruletype==12)) {
			console.log('Missing parameter: attribute_name'.red);
			return;
		}
		
		var rule_text1 = null;
		var rule_text2 = null;
		var rule_text3 = null;
		
		// Sum
		if (cmd.ruletype == 1) {
			if ( ! cmd.role_name) {
				console.log('Sum Rule is Missing parameter: role_name'.red);
				return;
			}
			if ( ! cmd.child_attribute) {
				console.log('Sum Rule is Missing parameter: child_attribute'.red);
				return;
			}
			rule_text1 = cmd.role_name;
			rule_text2 = cmd.clause;
			rule_text3 = cmd.child_attribute;
		}
		
		// Count
		if (cmd.ruletype == 2) {
			if ( ! cmd.role_name) {
				console.log('Count Rule is Missing parameter: role_name'.red);
				return;
			}
			
			rule_text1 = cmd.role_name;
			rule_text2 = cmd.clause;
			
		}
		// Formula
		var prop4 = null;
		if (cmd.ruletype === 3) {
			if ( ! cmd.expression) {
				console.log('Formula Rule is Missing parameter: expression'.red);
				return;
			}
			rule_text1 = cmd.expression;
			prop4 = 'javascript';
		}
		
		// Validation
		if (cmd.ruletype === 5 || cmd.ruletype === 6) {
			if ( ! cmd.expression) {
				console.log('Validation is Missing parameter: expression'.red);
				return;
			}
			rule_text1 = cmd.expression;
			prop4 = 'javascript';
			rule_text2 = cmd.error_message;
		}
		// Events
		if (cmd.ruletype === 7 || cmd.ruletype === 8 || cmd.ruletype === 9 || cmd.ruletype === 10) {
			if ( ! cmd.expression) {
				console.log('Event is Missing parameter: expression'.red);
				return;
			}
			rule_text1 = cmd.expression;
			prop4 = 'javascript';
		}
		// Parent copy
		if (cmd.ruletype == 4) {
			if ( ! cmd.role_name) {
				console.log('Parent Copy Missing parameter: role_name'.red);
				return;
			}
			if ( ! cmd.parent_attribute) {
				console.log('Parent Copy is Missing parameter: parent_attribute'.red);
				return;
			}
			rule_text1 = cmd.role_name;
			rule_text2 = cmd.parent_attribute;
		}
		// Min/Max
		if (cmd.ruletype == 11 || cmd.ruletpe == 12) {
			if ( ! cmd.role_name) {
				console.log('Min/Max is Missing parameter: role_name'.red);
				return;
			}
			if ( ! cmd.child_attribute) {
				console.log('Min/Max Rule is Missing parameter: child_attribute'.red);
				return;
			}
			rule_text1 = cmd.role_name;
			rule_text2 = cmd.clause;
			rule_text3 = cmd.child_attribute;
		}
		// managed parent (insert parent if none)
		if (cmd.ruletype == 13) {
			if ( ! cmd.role_name) {
				console.log('Manage Parent Rule is Missing parameter Role to Parent: role_name'.red);
				return;
			}
			rule_text1 = cmd.role_name;
		
		}
		var curProj = cmd.project_ident;
		var jit = false;
		if(cmd.jit !== null){
			jit = cmd.jit;
		}
		var ruleActive = true;
		if(cmd.active !== null){
			ruleActive = cmd.active;
		}
		var rule_name = null;
		if (cmd.rule_name) {
			rule_name = cmd.rule_name;
		}
		var sqlable = false;
		if(cmd.sqlable !== null){
			sqlable = cmd.sqlable;
		}
		if ( ! curProj) {
			curProj = dotfile.getCurrentProject();
		}
		if ( ! curProj) {
			console.log('There is no current project.'.yellow);
			return;
		}
		var rule_name = (cmd.rule_name == 'null')?null:cmd.rule_name;
		var newRule = {
			name: rule_name,
			entity_name: cmd.entity_name,
			attribute_name: cmd.attribute_name,
			prop4: prop4,
			rule_text1: rule_text1,
			rule_text2: rule_text2,
			rule_text3: rule_text3,
			name: rule_name,
			comments: cmd.comments || "",
			active: ruleActive,
			ruletype_ident: cmd.ruletype,
			project_ident: curProj,
			jit: jit,
			sqlable: sqlable
		};
		var startTime = new Date();
		client.post(loginInfo.url + "/rules", {
			data: newRule,
			headers: {
				Authorization: "CALiveAPICreator " + loginInfo.apiKey + ":1",
				"Content-Type" : "application/json"
			}
		}, function(data) {
			var endTime = new Date();
			if (data.errorMessage) {
				console.log(data.errorMessage.red);
				return;
			}
			printObject.printHeader('Rule was created');
			_.each(data.txsummary, function(obj) {
				printObject.printObject(obj, obj['@metadata'].entity, 0, obj['@metadata'].verb);
			});
			var trailer = "Request took: " + (endTime - startTime) + "ms";
			trailer += " - # objects touched: ";
			if (data.txsummary.length == 0) {
				console.log('No data returned'.yellow);
			}
			else {
				trailer += data.txsummary.length;
			}
			printObject.printHeader(trailer);
		});
	},
	
	update: function(cmd) {
		console.log('Sorry, this function is not yet implemented');
	},
	
	del : function(cmd) {
		var client = new Client();
		var loginInfo = login.login(cmd);
		if ( ! loginInfo) {
			console.log('You are not currently logged into any API Creator server.'.red);
			return;
		}

        var projIdent = cmd.project_ident;
        if ( ! projIdent) {
            projIdent = dotfile.getCurrentProject();
            if ( ! projIdent) {
                console.log('There is no current project.'.yellow);
                return;
            }
        }
        filt = "equal(project_ident:"+projIdent;
		if (cmd.ident) {
			filt += ",ident:" + cmd.ident +")";
		}
		else if (cmd.rule_name) {
			filt += ",name:'" + cmd.rule_name + "')";
		}
		else {
			console.log('Missing parameter: please specify either rule_name or ident'.red);
			return;
		}

		client.get(loginInfo.url + "/admin:rules?sysfilter=" + filt, {
			headers: {
				Authorization: "CALiveAPICreator " + loginInfo.apiKey + ":1",
				"Content-Type" : "application/json"
			}
		}, function(data) {
			//console.log('get result: ' + JSON.stringify(data, null, 2));
			if (data.errorMessage) {
				console.log(("Error: " + data.errorMessage).red);
				return;
			}
			if (data.length === 0) {
				console.log(("Rule(s) not found").red);
				return;
			}
			if (data.length > 1) {
				console.log(("Error: more than one rule returned for the given condition: " + filt).red);
				return;
			}
			var db = data[0];
			var startTime = new Date();
			client['delete'](db['@metadata'].href + "?checksum=" + db['@metadata'].checksum, {
				headers: {
					Authorization: "CALiveAPICreator " + loginInfo.apiKey + ":1",
					"Content-Type" : "application/json"
				}
			}, function(data2) {
				var endTime = new Date();
				if (data2.errorMessage) {
					console.log(data2.errorMessage.red);
					return;
				}
				printObject.printHeader('Database connection was deleted, including the following objects:');
				_.each(data2.txsummary, function(obj) {
					printObject.printObject(obj, obj['@metadata'].entity, 0, obj['@metadata'].verb);
				});
				var trailer = "Request took: " + (endTime - startTime) + "ms";
				trailer += " - # objects touched: ";
				if (data2.txsummary.length == 0) {
					console.log('No data returned'.yellow);
				}
				else {
					trailer += data2.txsummary.length;
				}
				printObject.printHeader(trailer);
			});
		});
	},
	getRuleType: function(ruleType) {
			var type = null;
			switch(ruleType){
				case 1: type = "sum"; 
					break;
				case 2: type = "count"; 
					break;
				case 3: type = "formula"; 
					break;
				case 4: type = "parent copy"; 
					break;
				case 5: type = "validation"; 
					break;
				case 6: type = "commit validation"; 
					break;
				case 7: type = "event"; 
					break;
				case 8: type = "early event"; 
					break;
				case 9: type = "commit event"; 
					break;
				case 10: type = "pre-insert";
					break;
				case 11: type = "minimum"; 
					break;
				case 12: type = "maximum"; 
					break;
				case 13: type = "managed parent"; 
					break;
				default: type = "unknown";
			}
			return type;
	},
	show: function(p){
	var adminCmd = "";
			switch(p.ruletype_ident) {
					case 1: type = "sum"; 
					adminCmd += "lacadmin rule create --ruletype sum --entity_name "+p.entity_name;
					adminCmd += " --attribute_name "+p.attribute_name;
					adminCmd += " --rule_name "+p.name;
					adminCmd += " --role_name "+p.rule_text1;
					adminCmd += " --child_attribute "+p.rule_text3;
					adminCmd += " --clause '"+p.rule_text2+"'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --jit "+ p.jit;
					adminCmd += " --sqlable "+ p.sqlable;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 2: type = "count"; 
					adminCmd += "lacadmin rule create --ruletype count --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name+ "'";
					adminCmd += " --role_name "+p.rule_text1;
					adminCmd += " --attribute_name "+p.attribute_name;
					adminCmd += " --clause '"+p.rule_text2+"'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --jit "+ p.jit;
					adminCmd += " --sqlable "+ p.sqlable;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 3: type = "formula"; 
					adminCmd += "lacadmin rule create --ruletype formula --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name+ "'";
					adminCmd += " --attribute_name "+p.attribute_name;
					adminCmd += " --expression '"+p.rule_text1 + "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --jit "+ p.jit;
					adminCmd += " --sqlable "+ p.sqlable;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 4: type = "parent copy"; 
					adminCmd += "lacadmin rule create --ruletype parentcopy --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name+ "'";
					adminCmd += " --attribute_name "+p.attribute_name;
					adminCmd += " --role_name "+p.rule_text1;
					adminCmd += " --parent_attribute "+p.rule_text2;
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 5: type = "validation"; 
					adminCmd += "lacadmin rule create --ruletype validation --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name + "'";
					adminCmd += " --expression '"+p.rule_text1 + "'";
					adminCmd += " --error_message '"+p.rule_text2 +"'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 6: type = "commit validation"; 
					adminCmd += "lacadmin rule create --ruletype commitvalidation --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name + "'";
					adminCmd += " --expression '"+p.rule_text1 + "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 7: type = "event"; 
					adminCmd += "lacadmin rule create --ruletype event --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name+ "'";
					adminCmd += " --expression '"+p.rule_text1 +"'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 8: type = "early event"; 
					adminCmd += "lacadmin rule create --ruletype earlyevent --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name + "'";
					adminCmd += " --expression '"+p.rule_text1 + "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 9: type = "commit event"; 
					adminCmd += "lacadmin rule create --ruletype commitevent --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name+ "'";
					adminCmd += " --expression '"+p.rule_text1 + "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";
					adminCmd += "\n\n";
					break;
					case 10: type = "pre-insert";
					adminCmd += "lacadmin rule create --ruletype pre-insert --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name + "'";
					adminCmd += " --expression '"+p.rule_text1 + "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 11: type = "minimum"; 
					adminCmd += "lacadmin rule create --ruletype minimum --entity_name "+p.entity_name;
					adminCmd += " --rule_name '"+p.name + "'";
					adminCmd += " --attribute_name "+p.attribute_name;
					adminCmd += " --role_name "+p.rule_text1;
					adminCmd += " --child_attribute "+p.rule_text3;
					adminCmd += " --clause '"+p.rule_text2+ "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --jit "+ p.jit;
					adminCmd += " --sqlable "+ p.sqlable;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 12: type = "maximum"; 
					adminCmd += "lacadmin rule create --ruletype maximum --entity_name "+p.entity_name;
					adminCmd += " --rule_name "+p.name;
					adminCmd += " --attribute_name "+p.attribute_name;
					adminCmd += " --role_name "+p.rule_text1;
					adminCmd += " --child_attribute "+p.rule_text3;
					adminCmd += " --clause '"+p.rule_text2 + "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --jit "+ p.jit;
					adminCmd += " --sqlable "+ p.sqlable;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					case 13: type = "managed parent"; 
					adminCmd += "lacadmin rule create --ruletype managedparent --entity_name "+p.entity_name;
					adminCmd += " --rule_name "+p.name;
					adminCmd += " --role_name "+p.rule_text1;
					adminCmd += " --expression '"+p.rule_text1 + "'";
					adminCmd += " --active "+ p.active;
					adminCmd += " --comments '"+p.comments +"'";	
					adminCmd += "\n\n";
					break;
					default: type = "unknown";
				}
				return adminCmd;
	},
	export: function(cmd) {
		var client = new Client();
		var loginInfo = login.login(cmd);
		if ( ! loginInfo)
			return;
			
		var url = loginInfo.url;
		var apiKey = loginInfo.apiKey;
		
		
		var projIdent = cmd.project_ident;
		if ( ! projIdent) {
			projIdent = dotfile.getCurrentProject();
			if ( ! projIdent) {
				console.log('There is no current project.'.yellow);
				return;
			}
		}

		var filter = "";
		if(cmd.ident){
			filter = "&sysfilter=equal(ident: "+cmd.ident+")";
		} else {
			if(cmd.rule_name) {
				filter = "&sysfilter=equal(name: '"+cmd.rule_name+"')";
			}
		}
		client.get(url + "/rules?sysfilter=equal(project_ident:" + projIdent +")&pagesize=500"+filter, {
			headers: {
				Authorization: "CALiveAPICreator " + loginInfo.apiKey + ":1",
				"Content-Type" : "application/json"
			}
		}, function(data) {
			//console.log('get result: ' + JSON.stringify(data, null, 2));
			if (data.errorMessage) {
				console.log(("Error: " + data.errorMessage).red);
				return;
			}
			var toStdout = false;
			if ( ! cmd.file) {
				toStdout = true;
			}
			if (data.length === 0) {
				console.log(("Rule(s) not found").red);
				return;
			}
			for(var i = 0; i < data.length ; i++){
			      delete data[i].ident;
			      delete data[i].project_ident;
			      delete data[i]['@metadata'].links;
			}
			if (toStdout) {
				console.log(JSON.stringify(data, null, 2));
				
			} else {
				var exportFile = fs.openSync(cmd.file, 'w+', 0600);
				fs.writeSync(exportFile, JSON.stringify(data, null, 2));
				console.log(('Rules have been exported to file: ' + cmd.file).green);
			}
		});	
	},
	import: function(cmd) {
		var client = new Client();
		var loginInfo = login.login(cmd);
		if ( ! loginInfo) {
			return;
		}

		var projIdent = cmd.project_ident;
		if ( ! projIdent) {
			projIdent = dotfile.getCurrentProject();
			if ( ! projIdent) {
				console.log('There is no current project.'.yellow);
				return;
			}
		}
		if ( ! cmd.file) {
			cmd.file = '/dev/stdin';
		}
		
		var fileContent = JSON.parse(fs.readFileSync(cmd.file));
		if(Array.isArray(fileContent) && fileContent.length > 0){
			for(var i = 0 ; i < fileContent.length ; i++ ){
				fileContent[i].project_ident = projIdent;
				delete fileContent[i].ts;
				//fileContent[i]["@metadata"] = {action:"MERGE_INSERT"} ;
			}
		} else {
			fileContent.project_ident = projIdent;
			delete fileContent.ts;
			//fileContent["@metadata"] = {action:"MERGE_INSERT"} ;
		}
		
		var startTime = new Date();
		client.post(loginInfo.url + "/AllRules", {
			data: fileContent,
			headers: {
				Authorization: "CALiveAPICreator " + loginInfo.apiKey + ":1",
				"Content-Type" : "application/json"
			}
		}, function(data) {
		
			var endTime = new Date();
			if (data.errorMessage) {
				console.log(data.errorMessage.red);
				return;
			}
			printObject.printHeader('Rule(s) created, including:');
			if(data.statusCode == 200 ){
				console.log("Request took: " + (endTime - startTime) + "ms");
				return;
			} 	
			var newRule = _.find( data.txsummary, function(p) {
				return p['@metadata'].resource === 'AllRules';
			});
			if ( ! newRule) {
				console.log('ERROR: unable to find imported rules'.red);
				return;
			}
			if (cmd.verbose) {
				_.each(data.txsummary, function(obj) {
					printObject.printObject(obj, obj['@metadata'].entity, 0, obj['@metadata'].verb);
				});
			}
			else {
				printObject.printObject(newRule, newRule['@metadata'].entity, 0, newRule['@metadata'].verb);
				console.log(('and ' + (data.txsummary.length - 1) + ' other objects').grey);
			}
			
			var trailer = "Request took: " + (endTime - startTime) + "ms";
			trailer += " - # objects touched: ";
			if (data.txsummary.length === 0) {
				console.log('No data returned'.yellow);
			}
			else {
				trailer += data.txsummary.length;
			}
			printObject.printHeader(trailer);
		});
	}
};
