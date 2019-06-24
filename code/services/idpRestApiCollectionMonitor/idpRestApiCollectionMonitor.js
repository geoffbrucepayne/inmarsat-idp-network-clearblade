// TRIGGER on IdpRestApiCalls item created

/**
 * Service to monitor and cull size of the IDP API Collection
 */
function idpRestApiCollectionMonitor(req, resp) {
  var maxItemCount = MAX_API_RECORDS;
  var collName = COL_API_CALLS;
  var fName = entryLog(arguments.callee.name, 'triggered with max item count: ' + maxItemCount);

  ClearBlade.init({request:req});
  var col = ClearBlade.Collection({collectionName:collName});
  var rowsToDelete = 0;
  var rowsDeleted = 0;

  var deleteOldestRow = function (item_id) {
    vlog(logLevels.DEBUG, fName + ' deleteOldestRow deleting row ' + item_id);
    var col = ClearBlade.Collection({collectionName:collName});
    var query = ClearBlade.Query();
    query.equalTo('item_id', item_id);
    col.remove(query, function(err, result) {
        if (err) {
          vlog(logLevels.ERROR, fName + ' deleteOldestRow error: ' + JSON.stringify(result));
          resp.error('Collection remove error: ' + JSON.stringify(result));
        } else {
          vlog(logLevels.DEBUG, fName + ' deleted oldest row: ' + JSON.stringify(result));
          rowsDeleted++;
        }
    });
  };
    
    // TODO: check various API error conditions that should be notified to an admin indicating a problem needing investigation
    
  col.count(function(err, result){
      if (err) {
        vlog(logLevels.ERROR, fName + ' Collection count error: ' + JSON.stringify(result));
        resp.error('Collection count error: ' + JSON.stringify(result));
      } else {
        vlog(logLevels.DEBUG, fName + ' IDP API collection has ' + result.count + ' items of ' + maxItemCount + ' allowed');
        if (result.count > maxItemCount) {
            rowsToDelete = result.count - maxItemCount;
        }
        vlog(logLevels.DEBUG, fName + ' identified ' + rowsToDelete + ' rows to delete');
      }
  });
  if (rowsToDelete > 0) {
    var qDeleteRows = ClearBlade.Query({collectionName:collName});
    qDeleteRows.ascending('call_time');
    qDeleteRows.setPage(rowsToDelete, 1);
    qDeleteRows.fetch(function(err, result){
      if (err) {
        vlog(logLevels.ERROR, fName + ' qDeleteRows Query error: ' + JSON.stringify(result));
        resp.error('Query error: ' + JSON.stringify(result));
      } else {
        vlog(logLevels.INFO, fName + ' qDeleteRows found ' + result.DATA.length + ' results');
        for (var i=0; i < result.DATA.length; i++) {
            deleteOldestRow(result.DATA[i].item_id);
        }
      }
    });
  }
  if (rowsDeleted > 0) {
    vlog(logLevels.INFO, fName + 'Deleted ' + rowsDeleted + ' rows');
  }
  resp.success('Deleted ' + rowsDeleted + ' rows.');
}
