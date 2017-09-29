import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import { List } from "linqts";
import "rxjs/add/operator/map";

import { AppUtility } from "../helpers/utility";
import { AppAPI } from "../helpers/api";
import { AppCrypto } from "../helpers/crypto";
import { AppEvents } from "../helpers/events";
import { AppRTU } from "../helpers/rtu";
import { AppData } from "../models/data";
import { AppModels } from "../models/objects";

import { ConfigurationService } from "./configuration";
import { StatisticsService } from "./statistics";
import { BooksService } from "./books";

@Injectable()
export class LibrariesService {

	constructor(
		public http: Http,
		public configSvc: ConfigurationService,
		public statisticsSvc: StatisticsService,
		public booksSvc: BooksService
	){
		AppAPI.setHttp(this.http);
		AppRTU.register("Libraries", (message: any) => this.processRTU(message));
	}

	search(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		request.Pagination.PageNumber++;
		let path = "libraries/library/search"
			+ "?x-request=" + AppUtility.getBase64UrlParam(request);
		var searcher = AppAPI.Get(path);

		if (!onNext) {
			return searcher;
		}

		searcher.map(response => response.json()).subscribe(
			(data: any) => {
				if (data.Status == "OK") {
					new List<any>(data.Data.Objects).ForEach(lib => AppModels.Library.update(lib));
					!AppUtility.isNotEmpty(request.FilterBy.Query) && AppData.Paginations.set(data.Data, "L");
					onNext(data);
				}
				else {
					console.error("[Libraries]: Error occurred while searching libraries");
					AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
					onError != undefined && onError(data);
				}
			},
			(error: any) => {
				console.error("[Libraries]: Error occurred while searching libraries", error);
				onError != undefined && onError(error);
			}
		);
	}

	async fetchAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		var pagination = AppData.Paginations.get(request, "L");
		if (AppUtility.isObject(pagination, true) && pagination.TotalPages && pagination.PageNumber && pagination.PageNumber >= pagination.TotalPages) {
			onNext != undefined && onNext();
			return;
		}

		try {
			request.Pagination.PageNumber++;
			let path = "libraries/library/search"
				+ "?x-request=" + AppUtility.getBase64UrlParam(request);
			let response = await AppAPI.GetAsync(path);
			let data = response.json();
			if (data.Status == "OK") {
				new List<any>(data.Data.Objects).ForEach(lib => AppModels.Library.update(lib));
				AppData.Paginations.set(data.Data, "L");
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while fetching libraries");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while fetching libraries", e);
			onError != undefined && onError(e);
		}
	}

	async registerAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.PostAsync("libraries/library", body);
			let data = response.json();
			if (data.Status == "OK") {
				AppModels.Library.update(data.Data);
				AppEvents.broadcast("LibrariesAreUpdated");
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while registering a library");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while registering a library", e);
			onError != undefined && onError(e);
		}
	}

	async getAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		var library = AppData.Libraries.getValue(id);
		if (library != undefined) {
			this.updateCounters(id);
			onNext != undefined && onNext();
			return;
		}

		try {
			let response = await AppAPI.GetAsync("libraries/library/" + id);
			let data = response.json();
			if (data.Status == "OK") {
				AppModels.Library.update(data.Data);
				this.updateCounters(id);
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while getting a library");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while getting a library", e);
			onError != undefined && onError(e);
		}
	}

	async getByAliasAsync(alias: string, onNext?: (lib: AppModels.Library) => void, onError?: (error?: any) => void) {
		var library = new List(AppData.Libraries.values()).FirstOrDefault(l => l.Alias == alias);
		if (library != undefined) {
			this.updateCounters(library.ID);
			onNext != undefined && onNext(library);
			return;
		}

		try {
			let response = await AppAPI.GetAsync("libraries/library/" + alias);
			let data = response.json();
			if (data.Status == "OK") {
				AppModels.Library.update(data.Data);
				library = AppData.Libraries.getValue(data.Data.ID);
				this.updateCounters(library.ID);
				onNext != undefined && onNext(library);
			}
			else {
				console.error("[Libraries]: Error occurred while getting a library (by alias)");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while getting a library (by alias)", e);
			onError != undefined && onError(e);
		}
	}

	updateCounters(id: string, action?: string, onCompleted?: () => void) {
		AppData.Libraries.getValue(id) != undefined
		&& AppRTU.isReady()
		&& AppRTU.call("libraries", "library", "GET", {
			"object-identity": "counters",
			"id": id,
			"action": action || "View"
		});
		onCompleted != undefined && onCompleted();
	}

	updateStatistics(info: any, onCompleted?: () => void) {
		var library = AppUtility.isObject(info, true)
			? AppData.Libraries.getValue(info.ID)
			: undefined;

		if (library) {
			if (info.Counters && AppUtility.isArray(info.Counters)) {
				new List<any>(info.Counters).ForEach(c => library.Counters.setValue(c.Type, AppModels.CounterInfo.deserialize(c)));
			}

			if (info.RatingPoints && AppUtility.isArray(info.RatingPoints)) {
				new List<any>(info.RatingPoints).ForEach(r => library.RatingPoints.setValue(r.Type, AppModels.RatingPoint.deserialize(r)));
			}
			
			if (info.Stocks && AppUtility.isArray(info.Stocks)) {
				new List<any>(info.Stocks).ForEach(c => library.Stocks.setValue(c.Type, AppModels.CounterBase.deserialize(c)));
			}
			
			if (info.LastUpdatedBooks && AppUtility.isArray(info.LastUpdatedBooks)) {
				library.LastUpdatedBooks = info.LastUpdatedBooks;
			}
			
			if (info.MostBorrowedBooks && AppUtility.isArray(info.MostBorrowedBooks)) {
				library.MostBorrowedBooks = info.MostBorrowedBooks;
			}

			AppEvents.broadcast("LibraryStatisticsAreUpdated", { ID: library.ID });
		}

		onCompleted != undefined && onCompleted();
	}

	async requestUpdateAsync(info: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.PostAsync("libraries/library/" + AppCrypto.urlEncode(info.ID) + "/" + AppUtility.getBase64UrlParam({ ID: info.ID }), info);
			let data = response.json();
			if (data.Status == "OK") {
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while sending request to update an e-library");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while sending request to update an e-library", e);
			onError != undefined && onError(e);
		}
	}

	async updateAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.PutAsync("libraries/library/" + body.ID, body);
			let data = response.json();
			if (data.Status == "OK") {
				AppModels.Library.update(data.Data);
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while updating a library");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while updating a library", e);
			onError != undefined && onError(e);
		}
	}

	async deleteAsync(info, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.DeleteAsync("libraries/library/" + info.ID);
			let data = response.json();
			if (data.Status == "OK") {
				AppData.Libraries.remove(info.BookID);
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while deleting a library");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while deleting a library", e);
			onError != undefined && onError(e);
		}
	}

	async updatePrivilegesAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.PostAsync("libraries/privileges/" + body.ID, body);
			let data = response.json();
			if (data.Status == "OK") {
				AppModels.Library.update(data.Data);
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while updating the privileges of a library");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while updating the privileges of a library", e);
			onError != undefined && onError(e);
		}
	}

	async updateCardsAsync(info: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.PostAsync("libraries/cards", info);
			let data = response.json();
			if (data.Status == "OK") {
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Libraries]: Error occurred while updating librarys' cards");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Libraries]: Error occurred while updating librarys' cards", e);
			onError != undefined && onError(e);
		}
	}

	processRTU(message: any) {
		// stop on error message
		if (message.Type == "Error") {
			console.warn("[Libraries]: got an error message from RTU", message);
			return;
		}

		// parse
		var info = AppRTU.parse(message.Type);

		// library information
		if (info.ObjectName == "Library") {
			AppModels.Library.update(message.Data);
		}

		// librarys' counters
		else if (info.ObjectName == "Library#Counters" || info.ObjectName == "Library#Statistics") {
			this.updateStatistics(message.Data);
		}

		// library is deleted
		else if (info.ObjectName == "Library#Delete") {
			AppData.Libraries.remove(message.Data.ID);
			AppEvents.broadcast("LibrariesAreUpdated");
		}
		
		// statistics
		else if (AppUtility.indexOf(info.ObjectName, "Statistic#") == 0) {
			this.statisticsSvc.processRTU(message);
		}
		
		// books
		else if (info.ObjectName.indexOf("Book") == 0) {
			this.booksSvc.processRTU(message);
		}
	}

}