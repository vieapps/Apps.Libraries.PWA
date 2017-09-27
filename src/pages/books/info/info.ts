import { Component } from "@angular/core";
import { NavController, NavParams, AlertController, ModalController } from "ionic-angular";

import { AppUtility } from "../../../helpers/utility";
import { AppEvents } from "../../../helpers/events";
import { AppData } from "../../../models/data";
import { AppModels } from "../../../models/objects";

import { ConfigurationService } from "../../../providers/configuration";
import { BooksService } from "../../../providers/books";

import { AddBookPage } from "../add/add";

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
		public booksSvc: BooksService
	){
	}

	// attributes
	info = {
		book: new AppModels.Book(),
		view: undefined as AppModels.CounterInfo,
		borrowed: undefined as AppModels.CounterInfo,
		title: "Thông tin",
		rating: 0.0,
		stocks: {
			libraries: 0,
			available: 0
		},
		limit: 260,
		uri: "",
		qrcode: "",
		processByApp: AppUtility.isNativeApp()
	};

	// events
	ionViewDidLoad() {
		var id = this.navParams.get("ID") as string;
		if (id && AppData.Books.containsKey(id)) {
			this.booksSvc.updateCounters(id);
			if (!AppData.Books.getValue(id).Cards) {
				this.booksSvc.getCards(id);
			}
			this.prepare();
		}
		else {
			this.booksSvc.getAsync(id, () => {
				if (AppData.Books.containsKey(id) && !AppData.Books.getValue(id).Cards) {
					this.booksSvc.getCards(id);
				}
				this.prepare();
			});
		}

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

		this.info.stocks.libraries = this.info.book.Cards
			? this.info.book.Cards.size() 
			: 0;

		this.info.stocks.available = this.info.book.Stocks.containsKey("Available")
			? this.info.book.Stocks.getValue("Available").Total
			: 0;

		this.info.uri = AppUtility.getUri() + "#?book=" + AppUtility.getBase64UrlParam({ ID: this.info.book.ID });
		this.info.qrcode = this.info.processByApp
			? "vieapps-paper-book://" + this.info.book.ID
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

	getSummary() {
		var summary = this.info.book.Summary;
		return this.info.limit > 0 && summary.length > this.info.limit
			? summary.substring(0, this.info.limit) + "..."
			: summary;
	}

	borrowBook() {
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

	showActions() {

	}

}