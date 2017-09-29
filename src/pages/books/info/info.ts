import { Component } from "@angular/core";
import { NavController, NavParams, AlertController, ModalController } from "ionic-angular";
import { List } from "linqts";

import { AppUtility } from "../../../helpers/utility";
import { AppEvents } from "../../../helpers/events";
import { AppData } from "../../../models/data";
import { AppModels } from "../../../models/objects";

import { ConfigurationService } from "../../../providers/configuration";
import { BooksService } from "../../../providers/books";
import { LibrariesService } from "../../../providers/libraries";

import { AddBookPage } from "../add/add";
import { LibraryInfoPage } from "../../libraries/info/info";

@Component({
	selector: "page-book-info",	
	templateUrl: "info.html"
})
export class BookInfoPage {
	constructor(
		public navCtrl: NavController,
		public navParams: NavParams,
		public alertCtrl: AlertController,
		public modalCtrl: ModalController,
		public configSvc: ConfigurationService,
		public booksSvc: BooksService,
		public libsSvc: LibrariesService
	){
	}

	// attributes
	info = {
		book: new AppModels.Book(),
		view: undefined as AppModels.CounterInfo,
		borrowed: undefined as AppModels.CounterInfo,
		libraries: new Array<{ id: string, title: string, avatar: string, address: string, available: number }>(),
		ratings: {},
		title: "Thông tin",
		rating: 0.0,
		limit: 260,
		uri: "",
		qrcode: "",
		processByApp: AppUtility.isNativeApp()
	};

	// events
	ionViewDidLoad() {
		var id = this.navParams.get("ID") as string;
		this.booksSvc.getAsync(id, () => {
			if (AppData.Books.containsKey(id) && !AppData.Books.getValue(id).Cards) {
				this.booksSvc.getCards(id);
			}
			this.prepare();
		});

		AppEvents.on(
			"BookStatisticsAreUpdated",
			(info: any) => {
				if (this.info.book && this.info.book.ID == info.args.ID) {
					this.prepare();
				}
			},
			"EventHandlerToUpdateBookStatistics"
		);
	}

	ionViewWillUnload() {
		AppEvents.off("BookStatisticsAreUpdated", "EventHandlerToUpdateBookStatistics");
	}

	prepare() {
		this.info.book = AppData.Books.getValue(this.navParams.get("ID") as string);
		AppEvents.broadcast("SetCategory", { Name: this.info.book.Category });
		
		this.info.view = this.info.book.Counters.getValue("View");
		this.info.borrowed = this.info.book.Counters.getValue("Borrowed");
		
		this.info.rating = this.info.book.RatingPoints.containsKey("General")
			? this.info.book.RatingPoints.getValue("General").Average
			: 0.0;

		this.info.libraries = [];
		new List(this.info.book.Cards ? this.info.book.Cards.values() : new Array<AppModels.Card>()).ForEach(c =>
		{
			let id = c.LibraryID;
			let lib = AppData.Libraries.getValue(id);
			if (lib) {
				this.info.libraries.push({
					id: lib.ID,
					title: lib.Title,
					avatar: lib.Avatar,
					address: lib.Address,
					available: c.Stocks.containsKey("Available")
						? c.Stocks.getValue("Available").Total
						: 0
				});
				this.info.ratings[lib.ID] = lib.RatingPoints && lib.RatingPoints.containsKey("General")
					? lib.RatingPoints.getValue("General").Average
					: 0.0;
			}
			else {
				this.libsSvc.getAsync(id, () => {
					lib = AppData.Libraries.getValue(id);
					this.info.libraries.push({
						id: lib.ID,
						title: lib.Title,
						avatar: lib.Avatar,
						address: lib.Address,
						available: c.Stocks.containsKey("Available")
							? c.Stocks.getValue("Available").Total
							: 0
					});
					this.info.ratings[lib.ID] = lib.RatingPoints && lib.RatingPoints.containsKey("General")
						? lib.RatingPoints.getValue("General").Average
						: 0.0;
				}, undefined, true);
			}
		});

		this.info.uri = AppUtility.getUri() + "#?book=" + AppUtility.getBase64UrlParam({ ID: this.info.book.ID });
		this.info.qrcode = this.info.processByApp
			? "vieapps-library-book://" + this.info.book.ID
			: this.info.uri;
	}

	showAlert(title: string, message: string, button?: string, func?: () => void) {
		this.alertCtrl.create({
			title: title,
			message: message,
			enableBackdropDismiss: true,
			buttons: [{
				text: button != undefined ? button : "Đóng",
				handler: () => {
					func != undefined && func();
				}
			}]
		}).present();
	}

	showActions() {
		
	}

	getSummary() {
		var summary = this.info.book.Summary;
		return this.info.limit > 0 && summary.length > this.info.limit
			? summary.substring(0, this.info.limit) + "..."
			: summary;
	}

	borrowBook(libraryID?: string) {
		if (!this.configSvc.isAuthenticated()) {
			this.showAlert("Chú ý", "Cần đăng nhập để có thể mượn được sách!");
		}
		else {
			
		}
	}

	canAddBook() {
		return this.configSvc.isAuthenticated() && AppData.Configuration.session.account.profile.Libraries.length > 0;		
	}

	addBook() {
		this.navCtrl.push(AddBookPage, { BookID: this.info.book.ID });
	}

	openLibrary(id: string) {
		this.navCtrl.push(LibraryInfoPage, { ID: id });
	}

}