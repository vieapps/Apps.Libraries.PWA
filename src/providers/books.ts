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

@Injectable()
export class BooksService {

	constructor(public http: Http) {
		AppAPI.setHttp(this.http);
	}

	search(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		request.Pagination.PageNumber++;
		let path = "libraries/book/search"
			+ "?x-request=" + AppUtility.getBase64UrlParam(request);
		var searcher = AppAPI.Get(path);

		if (onNext == undefined) {
			return searcher;
		}

		searcher.map(response => response.json()).subscribe(
			(data: any) => {
				if (data.Status == "OK") {
					new List<any>(data.Data.Objects).ForEach(b => AppModels.Book.update(b));
					!AppUtility.isNotEmpty(request.FilterBy.Query) && AppData.Paginations.set(data.Data, "B");
					onNext(data);
				}
				else {
					console.error("[Books]: Error occurred while searching books");
					AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
					onError != undefined && onError(data);
				}
			},
			(error: any) => {
				console.error("[Books]: Error occurred while searching books", error);
				onError != undefined && onError(error);
			}
		);
	}

	async fetchAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		var pagination = AppData.Paginations.get(request, "B");
		if (AppUtility.isObject(pagination, true) && pagination.TotalPages && pagination.PageNumber && pagination.PageNumber >= pagination.TotalPages) {
			onNext != undefined && onNext();
			return;
		}

		try {
			request.Pagination.PageNumber++;
			let path = "libraries/book/search"
				+ "?x-request=" + AppUtility.getBase64UrlParam(request);
			let response = await AppAPI.GetAsync(path);
			let data = response.json();
			if (data.Status == "OK") {
				new List<any>(data.Data.Objects).ForEach(b => AppModels.Book.update(b));
				AppData.Paginations.set(data.Data, "B");
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Books]: Error occurred while fetching books");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Books]: Error occurred while fetching books", e);
			onError != undefined && onError(e);
		}
	}

	async getAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		var book = AppData.Books.getValue(id);
		if (book != undefined) {
			this.updateCounters(id);
			onNext != undefined && onNext();
			return;
		}

		try {
			let response = await AppAPI.GetAsync("libraries/book/" + id);
			let data = response.json();
			if (data.Status == "OK") {
				AppModels.Book.update(data.Data);
				this.updateCounters(id);
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Books]: Error occurred while getting a book");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Books]: Error occurred while getting a book", e);
			onError != undefined && onError(e);
		}
	}

	updateCounters(id: string, action?: string, onCompleted?: () => void) {
		AppData.Books.getValue(id) != undefined
		&& AppRTU.isReady()
		&& AppRTU.call("libraries", "book", "GET", {
			"object-identity": "counters",
			"id": id,
			"action": action || "View"
		});
		onCompleted != undefined && onCompleted();
	}

	setCounters(info: any, onCompleted?: () => void) {
		var book = AppUtility.isObject(info, true)
			? AppData.Books.getValue(info.ID)
			: undefined;

		if (book != undefined && AppUtility.isArray(info.Counters)) {
			new List<any>(info.Counters).ForEach(c => book.Counters.setValue(c.Type, AppModels.CounterInfo.deserialize(c)));
			AppEvents.broadcast("BookStatisticsAreUpdated", { ID: book.ID });
		}

		onCompleted != undefined && onCompleted();
	}

	async requestUpdateAsync(info: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.PostAsync("libraries/book/" + AppCrypto.urlEncode(info.ID) + "/" + AppUtility.getBase64UrlParam({ ID: info.ID }), info);
			let data = response.json();
			if (data.Status == "OK") {
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Books]: Error occurred while sending request to update an e-book");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Books]: Error occurred while sending request to update an e-book", e);
			onError != undefined && onError(e);
		}
	}

	async updateAsync(info: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.PutAsync("libraries/book/" + AppCrypto.urlEncode(info.ID) + "/" + AppUtility.getBase64UrlParam({ ID: info.ID }), info);
			let data = response.json();
			if (data.Status == "OK") {
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Books]: Error occurred while updating an e-book");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Books]: Error occurred while updating an e-book", e);
			onError != undefined && onError(e);
		}
	}

	async deleteAsync(info, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.DeleteAsync("libraries/book/" + AppCrypto.urlEncode(info.BookID) + "/" + AppUtility.getBase64UrlParam({ ID: info.BookID }));
			let data = response.json();
			if (data.Status == "OK") {
				AppData.Books.remove(info.BookID);
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Books]: Error occurred while deleting an e-book");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Books]: Error occurred while deleting an e-book", e);
			onError != undefined && onError(e);
		}
	}

	processRTU(message: any) {
		// parse
		var info = AppRTU.parse(message.Type);

		// meta of a book
		if (info.ObjectName == "Book") {
			AppModels.Book.update(message.Data);
		}

		// counters
		else if (info.ObjectName == "Book#Counters") {
			this.setCounters(message.Data);
		}

		// delete
		else if (info.ObjectName == "Book#Delete") {
			AppData.Books.remove(message.Data.ID);
			AppEvents.broadcast("BooksAreUpdated");
		}
	}

}