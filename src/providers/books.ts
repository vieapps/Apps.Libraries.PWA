import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import { List } from "linqts";
import * as Collections from "typescript-collections";
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
		if (book) {
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
		AppData.Books.getValue(id) && AppRTU.isReady()
		&& AppRTU.call("libraries", "book", "GET", {
			"object-identity": "counters",
			"id": id,
			"action": action || "View"
		});
		onCompleted != undefined && onCompleted();
	}

	getCards(id: string, action?: string, onCompleted?: () => void) {
		AppData.Books.containsKey(id) && AppRTU.isReady()
		&& AppRTU.call("libraries", "book", "GET", {
			"object-identity": "cards",
			"id": id
		});
		onCompleted != undefined && onCompleted();
	}

	updateStatistics(data: any, onCompleted?: () => void) {
		var book = AppUtility.isObject(data, true)
			? AppData.Books.getValue(data.ID)
			: undefined;

		if (book) {
			// counters
			if (AppUtility.isArray(data.Counters)) {
				new List<any>(data.Counters).ForEach(c => book.Counters.setValue(c.Type, AppModels.CounterInfo.deserialize(c)));
			}

			// rating points
			if (AppUtility.isArray(data.RatingPoints)) {
				new List<any>(data.RatingPoints).ForEach(r => book.RatingPoints.setValue(r.Type, AppModels.RatingPoint.deserialize(r)));
			}
			
			// stocks
			if (AppUtility.isArray(data.Stocks)) {
				new List<any>(data.Stocks).ForEach(c => book.Stocks.setValue(c.Type, AppModels.CounterBase.deserialize(c)));
			}

			// cards
			if (AppUtility.isArray(data.Cards)) {
				book.Cards = book.Cards || new Collections.Dictionary<string, AppModels.Card>();
				new List<any>(data.Cards).ForEach(c => book.Cards.setValue(c.ID, AppModels.Card.deserialize(c)));
			}

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

		// statistics
		else if (info.ObjectName == "Book#Counters" || info.ObjectName == "Book#Cards" || info.ObjectName == "Book#Statistics") {
			this.updateStatistics(message.Data);
		}

		// delete
		else if (info.ObjectName == "Book#Delete") {
			AppData.Books.remove(message.Data.ID);
			AppEvents.broadcast("BooksAreUpdated");
		}
	}

}