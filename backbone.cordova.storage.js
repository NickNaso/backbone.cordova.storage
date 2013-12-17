/*******************************************************************************
* Copyright (c) 2012, 2013 Nacios Technologies.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Apache License Version 2.0
* which accompanies this distribution, and is available at
* http://www.apache.org/licenses/
*
* Document: backbone.cordova.storage.js
* Created on: 28.10.2013
* Version: 1.0
* Repository: https://github.com/naciostechnologies/backbone.cordova.storage
* Author: Nacios Technologies
*
* Contributors:
* Nacios Technologies - initial API and implementation
* Mauro Brasiliano - Nicola Del Gobbo - Vincenzo Villani
*******************************************************************************/

(function(root, factory){
	if (typeof exports === 'object' && typeof require === 'function') {
     module.exports = factory(require('underscore'), require('backbone'), require('cordova'));
   } else if (typeof define === "function" && define.amd) {
      // AMD. Register as an anonymous module.
      define(['underscore','backbone','cordova'], function(_, Backbone, cordova) {
        // Use global variables if the locals are undefined.
        return factory(_ || root._, Backbone || root.Backbone, cordova || root.cordova);
      });
   } else {
      // RequireJS isn't being used. Assume underscore and backbone are loaded in <script> tags
      factory(_, Backbone, cordova);
   }
}(this,function(_, Backbone, cordova){
/* ===================================== [UTILITY FUNCTIONS START] ====================================== */

/* Extension version */
BACKBONE_CORDOVA_STORAGE_VERSION = 'B1.1.0-C3.1.0';
/* Enable | Disable debug */
DEBUG = true;
/* Default logical condition for SQL queries */
SQL_DEFAUL_LOGICAL_CONDITION = 'AND';
/* Logical condition for SQL queries */
LOGICAL_CONDITION = ['AND','OR'];
/* Default order for SQL queries */
SQL_DEFAULT_ORDER = 'ASC';
/* Orders for SQL queries */
SQL_ORDERS = ['ASC', 'DESC'];
/* Query to obtain last insert id */
SQL_LAST_INSERT_ID = "SELECT `seq` FROM `SQLITE_SEQUENCE` WHERE `name`=?";
/* Message corresponding to error code of SQLError object */
SQL_ERROR = ['UNKNOWN ERROR', 'DATABASE ERROR', 'VERSION ERROR', 'TOO LARGE ERROR', 'QUOTA ERROR', 'SYNTAX ERROR', 'CONSTRAINT ERROR', 'TIMEOUT ERROR'];

/* ====================================== [UTILITY FUNCTIONS END] ======================================= */


/* ==================================== [SQLiteCordovaStorage START] ==================================== */

var SQLiteCordovaStorage = function(db, tableName){
	this.version = BACKBONE_CORDOVA_STORAGE_VERSION;
	this.debug = DEBUG;
    if(tableName == undefined || tableName == null || tableName.length == 0)
    	throw "SQLiteCordovaStorage: tableName must be a valid name in according with SQLite specifications.\n"
              +"See: http://www.sqlite.org/docs.html";
	else
		this.tableName = tableName;
	if(db == undefined || db == null)
		throw "SQLiteCordovaStorage: db must a valid instance of Database object.\n"
	          +"See: http://docs.phonegap.com/en/3.1.0/cordova_storage_storage.md.html#Storage";
	else	
		this.db = db;
	if(self.debug == true)
		console.log("SQLiteCordovaStorage adapter for Backbone.js and Cordova storage successfully created.");
};

_.extend(SQLiteCordovaStorage.prototype,{
    
	create: function(model, success, error, options){
		if(this.debug == true)
			console.log("SQLiteCordovaStorage: calling create - Insert new element.");
		var self = this;
		var successLID = function(tx, results){
			if(results.rows.length != 0){
				var lastInsertId = results.rows.item(0).seq;
				var obj = model.toJSON();
				var sql = "INSERT INTO `"+self.tableName+"` ";
				var params = [];
				var colNames = [];
				var placeHolders = [];
				obj[model.idAttribute] = (lastInsertId+1);
				_.each(obj, function(v, k){
					params.push(v);
					colNames.push("`"+k+"`");
					placeHolders.push("?");
				});
				sql += "(" + colNames.join(", ")+") VALUES ("+placeHolders.join(", ")+");";
				model.set(obj);
				self._executeSql(sql, params, success, error, options);
			}
			else{
				console.error("SQLiteCordovaStorage: it's not possible to retrieve last insert id of "+self.tableName+". See: https://github.com/naciostechnologies/backbone.cordova.storage.");
			}
		};
		var errorLID = function(tx, error){
			console.error("SQLiteCordovaStorage: "+SQL_ERROR[error.code]+ " {" + error.message + "}. Check the syntax in your sql query. See: http://www.sqlite.org/docs.html.");
		}
		this._executeSql(SQL_LAST_INSERT_ID, [this.tableName], successLID, errorLID, {});

	},

	destroy: function(model, success, error, options){
		if(this.debug == true)
			console.log("SQLiteCordovaStorage: calling destroy - Delete element.");
		var idValue = (model.attributes[model.idAttribute] || model.attributes.id);
		var id =  model.idAttribute;
		var params = [idValue];
		var sql = "DELETE FROM `"+this.tableName+"` WHERE(`"+id+"`=?);";
		this._executeSql(sql, params, success, error, options);
	},

	find: function(model, success, error, options){
		if(this.debug == true)
			console.log("SQLiteCordovaStorage: calling find - Retrieve element.");
		var id = model.idAttribute;
		var params = [];
		if(options.filters == undefined || options.filters == null || (_.size(options.filters) != 1)){
			throw "SQLiteCordovaStorage: error calling find -  method fetch of Backbone.Model need filters options parameter. Es. model.fetch({filters:{id:1}}). "
				  +"The parameter represent value of id attribute of Backbone.Model. See: https://github.com/naciostechnologies/backbone.cordova.storage and http://backbonejs.org/#Model-fetch. "
				  +"In this case only one filters parameter is permitted.";
		}
		params.push(options.filters[id]);
		var sql = "SELECT * ";
		sql += ("FROM "+"`"+this.tableName+"` WHERE `"+id+"`=?");
		if(this.debug == true)
			console.log("SQLiteCordovaStorage: query sql -> "+sql);
		this._executeSql(sql, params, success, error, options);
	},

	findAll: function(collection, success, error, options){
		if(this.debug == true)
			console.log("SQLiteCordovaStorage: calling findAll - Retrieve all elements.");
		var sql = "";
		var params = [];
		var filters = options.filters;
		if(filters == undefined || filters == null){
			sql += "SELECT * FROM "+"`"+this.tableName+"`"+";";	
			this._executeSql(sql, params, success, error, options);
		}
		else{
			if(filters.query == undefined || filters.query == null || ((!(typeof filters.query == 'string')) && (!(filters.query instanceof Array)))){
				throw "SQLiteCordovaStorage: query field is not defined (It must be a string or an array). See: https://github.com/naciostechnologies/backbone.cordova.storage";
			}
			if(typeof filters.query == 'string'){
				sql = filters.query;
				this._executeSql(sql, params, success, error, options);
			}
			if(filters.query instanceof Array){
				if(filters.query.length == 0)
					throw "SQLiteCordovaStorage: query field of filters object cannot be an empty array. See: https://github.com/naciostechnologies/backbone.cordova.storage";
				sql += "SELECT * FROM "+"`"+this.tableName+"`"+" WHERE (";
				for(var i = 0; i < filters.query.length; i++){
					if(!(filters.query[i] instanceof Object) || (!filters.query[i].hasOwnProperty('field')) || (!filters.query[i].hasOwnProperty('condition')) || (!filters.query[i].hasOwnProperty('value')))
						throw "SQLiteCordovaStorage: query array have to contain object with properties: field - condition - value. See: https://github.com/naciostechnologies/backbone.cordova.storage";
					params.push(filters.query[i].value);
					sql += ("`"+filters.query[i].field+"` "+filters.query[i].condition+" ? ");
					if((filters.query.length - 1) != i)
						sql += (((filters.query[i].lcondition != undefined && filters.query[i].lcondition != null && (_.contains(LOGICAL_CONDITION, filters.query[i].lcondition.toUpperCase()))) ? filters.query[i].lcondition : SQL_DEFAUL_LOGICAL_CONDITION)+" ");
				}
				sql += ")";
				if(filters.order != undefined && filters.order != null){
					var order = filters.order;
					if(order.fields == undefined || order.fields == null || (!order.fields instanceof Array) || (order.fields.length == 0))
						throw "SQLiteCordovaStorage: fields property of order have to be a non empty array. See: https://github.com/naciostechnologies/backbone.cordova.storage";
					sql += " ORDER BY ";
					for(var i = 0; i < order.fields.length; i++){
						if((order.fields.length - 1) == i)
							sql += ("`"+order.fields[i]+"`");
						else
							sql += ("`"+order.fields[i]+"`,");
					}
					sql += (" "+((order.type != undefined && order.type != null && (_.contains(SQL_ORDERS,order.type.toUpperCase()))) ? order.type.toUpperCase() : SQL_DEFAULT_ORDER));
				}
				if(filters.limit != undefined && filters.limit != null){
					var limit = filters.limit;
					if(limit.start == undefined || limit.start == null || (!_.isNumber(limit.start)) || limit.start < 0 ||
					   limit.qty == undefined || limit.qty == null || (!_.isNumber(limit.qty)) || limit.qty < 0 )
						throw "SQLiteCordovaStorage: properties (start and qty) of limit have to be integer positive number. See: https://github.com/naciostechnologies/backbone.cordova.storage";
					sql += (" LIMIT "+limit.start+","+limit.qty);
				}
				sql += ";";
				this._executeSql(sql, params, success, error, options);
			}
		}	
	},

	update: function(model, success, error, options){
		if(this.debug)
			console.log("SQLiteCordovaStorage: calling update - Set element's fields.");
		var idValue = (model.attributes[model.idAttribute] || model.attributes.id);
		var id = model.idAttribute;
		var obj = model.toJSON();
		var params = [];
		var sql = "UPDATE `"+this.tableName+"` SET ";
		var updateStmt = [];
		_.each(obj, function(v, k){
			if(k != id){
				updateStmt.push(k+"=?");
				params.push(v);
			}
		});
		sql += (updateStmt.join(", ") + " WHERE( `"+id+"` = ? );");
		params.push(idValue);
		this._executeSql(sql, params, success, error, options);
	},

	_executeSql: function(sql, params, successCallback, errorCallback, options){
		if(this.debug)
			console.log("SQL query: "+sql+" Params: "+params);
        this.db.transaction(function(tx){
        	tx.executeSql(sql, params, successCallback, errorCallback);
        });
	}

});

/* ====================================== [Preserve compatibility for default sync() method  START ] ====================================== */

Backbone.RSync = Backbone.sync;

/* ======================================= [Preserve compatibility for default sync() method  END ] ======================================= */

/* ==================================== [Backbone.sync with SQLiteCordovaStorage implementation START] ==================================== */
Backbone.sync = function(method, model, options){
	var SQLiteStore = model.SQLiteStore || model.collection.SQLiteStore, success, error;
	if(SQLiteStore == null){
		throw "SQLiteCordovaStorage model or collection without SQLiteStore object. See: https://github.com/naciostechnologies/backbone.cordova.storage";
	}
	var isSingleResult = false;
	
	var success = function(tx, results) {
		console.log('SQLiteCordovaStorage: (success) requested query has been successfully executed.');	
		switch(method){
			case "read":
				if(results.rows.length > 0){
					if(isSingleResult == true){
						var res = results.rows.item(0);
					}
					else{
						var res = [];
						for(var i = 0; i < results.rows.length; i++){
							res.push(results.rows.item(i));
						}
					}
				}
				options.success(res); 
			break;
			case "create":
				if(results.rowsAffected == 1){
					var res = model.toJSON();
					res[model.idAttribute] = results.insertId;
					options.success(res);
				}
			break;
			case "update":
				if(results.rowsAffected == 1){
					options.success(model.toJSON());
				}
			break;
			case "delete":
				if(results.rowsAffected == 1){
					var res = model.toJSON();
					model.unset(model.idAttribute);
					delete res[model.idAttribute];
					options.success(res);
				}
			break;
		}
	};
	var error = function(tx, error) {
		if(this.debug == true)
			console.log('SQLiteCordovaStorage: (error) requested query has encountered a problem during execution.');
		console.error("SQLiteCordovaStorage: "+SQL_ERROR[error.code]+ " {" + error.message + "}. Requested query has encountered a problem during execution. See: http://www.sqlite.org/docs.html.");
		options.error(error);
	};
	
	switch(method){
		case "read":
		    if(model instanceof Backbone.Model){
		    	isSingleResult = true;
				SQLiteStore.find(model, success, error, options);	
		    }
		    else if(model instanceof Backbone.Collection){
		    	SQLiteStore.findAll(model, success, error, options);
		    }		
		break;
		case "create":
			SQLiteStore.create(model, success, error, options);
		break;
		case "update":
			SQLiteStore.update(model, success, error, options);
		break;
		case "delete":
			if(model.isNew())
				option.success();
				return false;
			SQLiteStore.destroy(model, success, error, options);
		break;
		default:
			throw "SQLiteCordovaStorage method: "+method+" is not supported. See: http://backbonejs.org/#Sync";
	}
};

/* ===================================== [Backbone.sync with SQLiteCordovaStorage implementation END] ===================================== */
 
return SQLiteCordovaStorage;

/* ===================================================== [SQLiteCordovaStorage END] ======================================================= */
}));