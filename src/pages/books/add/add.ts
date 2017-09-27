import { Component, ViewChild } from "@angular/core";
import { NavController, NavParams, AlertController } from "ionic-angular";
import { Keyboard } from "@ionic-native/keyboard";
import { CompleterItem } from "ng2-completer";
import { List } from "linqts";

import { AppUtility } from "../../../helpers/utility";
import { AppAPI } from "../../../helpers/api";
import { AppData } from "../../../models/data";
import { AppModels } from "../../../models/objects";

import { ConfigurationService } from "../../../providers/configuration";
import { AuthenticationService } from "../../../providers/authentication";
import { BooksService } from "../../../providers/books";
import { LibrariesService } from "../../../providers/libraries";

@Component({
	selector: "page-add-book",	
	templateUrl: "add.html"
})
export class AddBookPage {
	constructor(
		public navCtrl: NavController,
		public navParams: NavParams,
		public alertCtrl: AlertController,
		public keyboard: Keyboard,
		public configSvc: ConfigurationService,
		public authSvc: AuthenticationService,
		public booksSvc: BooksService,
		public libsSvc: LibrariesService
	){
	}

	// attributes
	info = {
		title: "Loading...",
		book: undefined as AppModels.Book,
		library: {
			id: undefined as string,
			current: undefined as AppModels.Library
		},
		libraries: new Array<{ id: string, title: string }>(),
		stocks: {},
		rating: 0.0,
		state: {
			adding: false,
			css: ""
		}
	};

	// controls
	@ViewChild("all") stockAllCtrl;
	@ViewChild("available") stockAvailableCtrl;
	searchCompleter: AppAPI.CompleterCustomSearch = undefined;

	// events
	ionViewDidLoad() {
		this.initialize();
	}

	ionViewCanEnter() {
		return this.configSvc.isAuthenticated() && AppData.Configuration.session.account.profile.Libraries.length > 0;
	}

	initialize() {
		this.info.library.id = this.navParams.get("LibraryID") as string;
		this.info.library.current = AppUtility.isNotEmpty(this.info.library.id)
			? AppData.Libraries.getValue(this.info.library.id)
			: undefined;
		this.info.book = AppData.Books.getValue(this.navParams.get("BookID") as string);

		AppUtility.setTimeout(async () => {
			await Promise.all(new List<string>(AppData.Configuration.session.account.profile.Libraries)
				.Select(id => {
					return this.libsSvc.getAsync(id,
						() => {
							let lib = AppData.Libraries.getValue(id);
							this.info.libraries.push({ id: lib.ID, title: lib.Title });
						}
					)
				})
				.ToArray()
			);
			this.prepare();
		});
	}

	prepare() {
		if (this.info.book) {
			this.showInfo(() => {
				this.setFocus();
			});
		}
		else {
			this.info.title = "Cập nhật sách vào thư viện";
			this.info.state.adding = true;
			this.info.state.css = AppUtility.getInputCss();
			this.searchCompleter = new AppAPI.CompleterCustomSearch(
				(term: string) => {
					return "libraries/book/search?x-request=" + AppUtility.getBase64UrlParam(AppData.buildRequest({ Query: term }));
				},
				(data: any) => {
					return new List<any>(data.Data.Objects)
						.Select(b => {
							return {
								title: b.Title,
								description: b.Author + " (" + b.Publisher + " - " + b.Producer + ")",
								image: AppUtility.getCoverImage(b.Cover),
								originalObject: AppModels.Book.deserialize(b)
							} as CompleterItem;
						})
						.ToArray();
				}
			);
		}
	}

	setFocus() {
		if (this.info.book) {
			AppUtility.focus(this.stockAllCtrl, this.keyboard, 456);
		}
		else {

		}
	}

	select(book: CompleterItem) {
		if (AppUtility.isObject(book, null) && AppUtility.isObject(book.originalObject, null)) {
			this.info.book = book.originalObject as AppModels.Book;
			this.showInfo(() => {
				this.setFocus();
			});
		}
	}

	showInfo(onCompleted?: () => void) {
		this.info.title = "Cập nhật: " + this.info.book.Title;

		this.info.rating = this.info.book.RatingPoints.containsKey("General")
			? this.info.book.RatingPoints.getValue("General").Average
			: 0.0;

		if (!this.info.library.current) {
			this.info.library.id = this.info.library.id
				? this.info.library.id
				: this.info.book.Cards.size() > 0
					? this.info.book.Cards.values()[0].LibraryID
					: this.info.libraries[0].id;
			this.info.library.current = AppData.Libraries.getValue(this.info.library.id);
		}
		
		this.info.stocks = {};
		new List(this.info.libraries).ForEach(i => {
			let card = new List(this.info.book.Cards.values()).FirstOrDefault(c => c.LibraryID == i.id);
			this.info.stocks[i.id] = {
				all: card != undefined
					? card.Stocks.getValue("All").Total
					: this.info.state.adding && i.id == this.info.library.id
						? 1
						: 0,
				available: card != undefined
					? card.Stocks.getValue("Available").Total
					: this.info.state.adding && i.id == this.info.library.id
						? 1
						: 0
			};
		});

		onCompleted != undefined && onCompleted();
	}

	onChange() {
		var all = this.info.stocks[this.info.library.id].all != undefined
			? +this.info.stocks[this.info.library.id].all
			: 0;
		this.info.stocks[this.info.library.id].all = all;

		var available = this.info.stocks[this.info.library.id].available != undefined
			? +this.info.stocks[this.info.library.id].available
			: 0;
		this.info.stocks[this.info.library.id].available = available > all ? all : available;
	}

	exit() {
		this.navCtrl.pop();
	}

	update() {
		var info = {
			BookID: this.info.book.ID,
			Stocks: new Array<any>()
		};
		for (let id in this.info.stocks) {
			let stock = this.info.stocks[id];
			info.Stocks.push({
				LibraryID: id,
				All: stock.all,
				Available: stock.available
			});
		}
		/*
		this.libsSvc.updateCardsAsync(info,
			() => {
				this.exit();
			},
			(e: any) => {
				this.alertCtrl.create({
					title: "Lỗi",
					message: AppUtility.isObject(e.Error, true) ? e.Error.Message : "Đã xảy ra lỗi!",
					enableBackdropDismiss: false,
					buttons: [{
						text: "Đóng"
					}]
				}).present();
			}
		);
		*/
	}

}