import { Component } from "@angular/core";
import { NavController, NavParams, AlertController, ModalController } from "ionic-angular";

import { AppUtility } from "../../../helpers/utility";
import { AppEvents } from "../../../helpers/events";
import { AppData } from "../../../models/data";
import { AppModels } from "../../../models/objects";

import { ConfigurationService } from "../../../providers/configuration";
import { BooksService } from "../../../providers/books";

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
		view: undefined,
		download: undefined,
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
		var existed = AppData.Books.containsKey(id);
			
		if (existed) {
			this.prepare(true);
		}
		else {
			this.booksSvc.getAsync(id, () => {
				this.prepare(true);
			});
		}

		AppEvents.on(
			"BookStatisticsAreUpdated",
			(info: any) => {
				if (this.info.book != undefined && this.info.book.ID == info.args.ID) {
					this.prepare();
				}
			},
			"EventHandlerToUpdateBookStatistics"
		);
	}

	ionViewWillUnload() {
		AppEvents.off("BookStatisticsAreUpdated", "EventHandlerToUpdateBookStatistics");
	}

	prepare(checkFiles?: boolean) {
		this.info.book = AppData.Books.getValue(this.navParams.get("ID") as string);
		this.info.view = this.info.book.Counters.getValue("View");
		this.info.download = this.info.book.Counters.getValue("Download");
		AppEvents.broadcast("SetCategory", { Name: this.info.book.Category });
		
		var rating = this.info.book.RatingPoints.getValue("General");
		this.info.rating = rating != undefined
			? rating.Average
			: 0.0;

		this.info.uri = AppUtility.getUri() + "#?book=" + AppUtility.getBase64UrlParam({ ID: this.info.book.ID });
		this.info.qrcode = this.info.processByApp
			? "vieapps-books://" + this.info.book.ID
			: this.info.uri;

		// to do: load cards

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

}