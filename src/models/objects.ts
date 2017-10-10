import * as Collections from "typescript-collections";
import { List } from "linqts";

import { AppUtility } from "../helpers/utility";
import { AppData } from "./data";

export namespace AppModels {
	/** Base of all model classes */
	export abstract class Base {
		abstract ID: string = "";

		/** Copys data from source (object or JSON) and fill into this objects' properties */
		copy(source: any, onCompleted?: (data: any) => void) {
			AppUtility.copy(source, this, onCompleted);
		}
	}

	/** Present details information of an account */
	export class Account extends Base {
		ID = "";
		Name = "";
		FirstName = "";
		LastName = "";
		BirthDay = "";
		Gender = "";
		Address = "";
		County = "";
		Province = "";
		Country = "";
		PostalCode = "";
		Email = "";
		Mobile = "";
		Avatar = "";
		Gravatar = "";
		Alias = "";
		Bio = "";
		Notes = "";
		Level = "";
		Reputation = "";
		TotalSpent = 0;
		TotalSold = 0;
		Deposit = 0;
		Debt = 0;
		TotalPoints = 0;
		RestPoints = 0;
		TotalRewards = 0;
		TotalContributions = 0;
		LastUpdated = new Date();
		RatingPoints = new Collections.Dictionary<string, RatingPoint>();
		WishList = new Array<string>();
		Libraries = new Array<string>();
		
		Joined = new Date();
		LastAccess = new Date();

		IsOnline = false;
		FullAddress = "";
		ANSITitle = "";
		ANSIAddress = "";
		
		constructor() {
			super();
			this.Gender = "NotProvided";
			this.Level = "Normal";
			this.Reputation = "Unknown";
		}

		static deserialize(json: any, account?: Account) {
			account = account || new Account();
			AppUtility.copy(json, account, (data: any) => {
				account.RatingPoints = new Collections.Dictionary<string, RatingPoint>();
				if (AppUtility.isArray(data.RatingPoints)) {
					new List<any>(data.RatingPoints).ForEach(r => account.RatingPoints.setValue(r.Type, RatingPoint.deserialize(r)));
				}

				if (AppUtility.isNotEmpty(account.BirthDay)) {
					account.BirthDay = account.BirthDay.replace(/--/g, "01").replace(/\//g, "-");
				}

				account.FullAddress = account.Address
					+ (AppUtility.isNotEmpty(account.Province) ? (AppUtility.isNotEmpty(account.Address) ? ", " : "")
					+ account.County + ", " + account.Province + ", " + account.Country : "");

				account.ANSITitle = AppUtility.toANSI(account.Name + " " + account.Email + " " + account.Mobile).toLowerCase();
				account.ANSIAddress = AppUtility.toANSI(account.FullAddress).toLowerCase();
			});
			return account;
		}

		static update(data: any) {
			if (AppUtility.isObject(data, true)) {
				let account = data instanceof Account
					? data as Account
					: Account.deserialize(data, AppData.Accounts.getValue(data.ID));
				if (AppData.Configuration.session.jwt != null && AppData.Configuration.session.jwt.uid == account.ID) {
					account.IsOnline = true;
				}
				AppData.Accounts.setValue(account.ID, account);
			}
		}
	}

	/** Present details information of a book */
	export class Book extends Base {
		ID = "";
		Title = "";
		Author = "";
		Translator = "";
		Category = "";
		Original = "";
		Publisher = "";
		Producer = "";
		Language = "";
		Status = "";
		Cover = "";
		Tags = "";
		PublishedDate = "";
		Price = 0;
		CoverType = "";
		Weight = 0;
		Dimenssions = "";
		Pages = 0;
		Summary = "";
		Counters: Collections.Dictionary<string, CounterInfo> = undefined;
		RatingPoints: Collections.Dictionary<string, RatingPoint> = undefined;
		Stocks: Collections.Dictionary<string, CounterBase> = undefined;
		Cards: Collections.Dictionary<string, Card> = undefined;
		LastUpdated = new Date();
		
		TotalOfAllBooks = 0;
		TotalOfAvailableBooks = 0;
		TotalOfLibraries = 0;

		ANSITitle = "";
		
		constructor() {
			super();
			this.Language = "vi";
		}

		static deserialize(json: any, book?: Book) {
			book = book || new Book();
			AppUtility.copy(json, book, (data: any) => {
				if (book.TotalOfAllBooks < 0) {
					book.TotalOfAllBooks = 0;
				}

				if (book.TotalOfAvailableBooks < 0) {
					book.TotalOfAvailableBooks = 0;
				}

				if (book.TotalOfLibraries < 0) {
					book.TotalOfLibraries = 0;
				}
						
				if (data.Counters && AppUtility.isArray(data.Counters)) {
					book.Counters = book.Counters instanceof Collections.Dictionary
						? book.Counters || new Collections.Dictionary<string, CounterInfo>()
						: new Collections.Dictionary<string, CounterInfo>();
					new List<any>(data.Counters).ForEach(c => book.Counters.setValue(c.Type, CounterInfo.deserialize(c)));
				}

				if (data.RatingPoints && AppUtility.isArray(data.RatingPoints)) {
					book.RatingPoints = book.RatingPoints instanceof Collections.Dictionary
						? book.RatingPoints || new Collections.Dictionary<string, RatingPoint>()
						: new Collections.Dictionary<string, RatingPoint>();
					new List<any>(data.RatingPoints).ForEach(r => book.RatingPoints.setValue(r.Type, RatingPoint.deserialize(r)));
				}
			
				if (data.Stocks && AppUtility.isArray(data.Stocks)) {
					book.Stocks = book.Stocks instanceof Collections.Dictionary
						? book.Stocks || new Collections.Dictionary<string, CounterBase>()
						: new Collections.Dictionary<string, CounterBase>();
					new List<any>(data.Stocks).ForEach(c => book.Stocks.setValue(c.Type, CounterBase.deserialize(c)));
				}
	
				if (data.Cards && AppUtility.isArray(data.Cards)) {
					book.Cards = book.Cards instanceof Collections.Dictionary
						? book.Cards || new Collections.Dictionary<string, Card>()
						: new Collections.Dictionary<string, Card>();
					new List<any>(data.Cards).ForEach(c => book.Cards.setValue(c.ID, Card.deserialize(c)));
				}

				book.ANSITitle = AppUtility.toANSI(book.Title + " " + book.Author).toLowerCase();
			});
			return book;
		}

		static update(data: any) {
			if (AppUtility.isObject(data, true)) {
				let book = data instanceof Book
					? data as Book
					: Book.deserialize(data, AppData.Books.getValue(data.ID));
				AppData.Books.setValue(book.ID, book);
			}
		}
	}

	/** Present details information of a library */
	export class Library extends Base {
		ID = "";
		Title = "";
		Alias = "";
		Contact = new ContactInfo();
		Avatar = "";
		Intro = "";
		OwnerID = "";
		Registered = new Date();
		Counters: Collections.Dictionary<string, CounterInfo> = undefined;
		RatingPoints: Collections.Dictionary<string, RatingPoint> = undefined;
		Stocks: Collections.Dictionary<string, CounterBase> = undefined;
		Privileges = new Privileges();
		Updated = new Date();
		UpdatedID = "";

		LastUpdatedBooks = new Array<string>();
		MostBorrowedBooks = new Array<string>();
		
		Address = "";
		ANSITitle = "";

		static deserialize(json: any, library?: Library) {
			library = library || new Library();
			AppUtility.copy(json, library, (data: any) => {
				if (AppUtility.isObject(data.Contact)) {
					library.Contact = ContactInfo.deserialize(data.Contact);
				}

				library.Counters = new Collections.Dictionary<string, CounterInfo>();
				new List<any>(data.Counters).ForEach(c => library.Counters.setValue(c.Type, CounterInfo.deserialize(c)));

				library.RatingPoints = new Collections.Dictionary<string, RatingPoint>();
				new List<any>(data.RatingPoints).ForEach(r => library.RatingPoints.setValue(r.Type, RatingPoint.deserialize(r)));
			
				library.Stocks = new Collections.Dictionary<string, CounterBase>();
				new List<any>(data.Stocks).ForEach(c => library.Stocks.setValue(c.Type, CounterBase.deserialize(c)));
	
				library.Privileges = AppUtility.isObject(data.Privileges, true)
					? Privileges.deserialize(data.Privileges)
					: library.Privileges instanceof Privileges ? library.Privileges : new Privileges();

				library.Address = library.Contact.Address + ", " + library.Contact.County + ", " + library.Contact.Province + ", " + library.Contact.Country;
				library.ANSITitle = AppUtility.toANSI(library.Title + " " + library.Alias).toLowerCase();
			});
			return library;
		}

		static update(data: any) {
			if (AppUtility.isObject(data, true)) {
				let library = data instanceof Library
					? data as Library
					: Library.deserialize(data, AppData.Libraries.getValue(data.ID));
				AppData.Libraries.setValue(library.ID, library);
			}
		}
	}

	export class Card extends Base {
		ID = "";
		LibraryID = "";
		BookID = "";
		Stocks = new Collections.Dictionary<string, CounterBase>();
		Updated = new Date();
		UpdatedID = "";

		static deserialize(json: any, card?: Card) {
			card = card || new Card();
			AppUtility.copy(json, card, (data: any) => {
				card.Stocks = new Collections.Dictionary<string, CounterBase>();
				new List<any>(data.Stocks).ForEach(c => card.Stocks.setValue(c.Type, CounterBase.deserialize(c)));
			});
			return card;
		}
	}

	export class Transaction extends Base {
		ID = "";
		LibraryID = "";
		Books = new Array<string>();
		Action = "";
		Status = "";
		RequestedBy = "";
		RequestedTime: Date;
		ProcessedBy = "";
		ProcessedTime: string = undefined;
		DeliveryBy = "";
		PickupTime: string = undefined;
		PickupAddress = new ContactInfo();
		DeliveryTime: string = undefined;
		DeliveryAddress = new ContactInfo();

		constructor() {
			super();
			this.Action = "Borrow";
			this.Status = "Pending";
		}

		static deserialize(json: any, transaction?: Transaction) {
			transaction = transaction || new Transaction();
			AppUtility.copy(json, transaction, (data: any) => {
				if (AppUtility.isObject(data.PickupAddress)) {
					transaction.PickupAddress = ContactInfo.deserialize(data.PickupAddress);
				}
				if (AppUtility.isObject(data.DeliveryAddress)) {
					transaction.DeliveryAddress = ContactInfo.deserialize(data.DeliveryAddress);
				}
			});
			return transaction;
		}

		static update(data: any) {
			if (AppUtility.isObject(data, true)) {
				let library = data instanceof Transaction
					? data as Transaction
					: Transaction.deserialize(data, AppData.Transactions.getValue(data.ID));
				AppData.Transactions.setValue(library.ID, library);
			}
		}
	}

	/** Access privilege on one specific service/object */
	export class Privilege {
		ServiceName = "";
		ObjectName = "";
		ObjectIdentity = "";
		Role = "";
		Actions = new Array<string>();

		static deserialize(json: any, privilege?: Privilege) {
			privilege = privilege || new Privilege();
			AppUtility.copy(json, privilege);
			return privilege;
		}
	}

	export class Privileges {
		DownloadableRoles = new Collections.Set<string>();
		DownloadableUsers = new Collections.Set<string>();
		ViewableRoles = new Collections.Set<string>();
		ViewableUsers = new Collections.Set<string>();
		ContributiveRoles = new Collections.Set<string>();
		ContributiveUsers = new Collections.Set<string>();
		EditableRoles = new Collections.Set<string>();
		EditableUsers = new Collections.Set<string>();
		ModerateRoles = new Collections.Set<string>();
		ModerateUsers = new Collections.Set<string>();
		AdministrativeRoles = new Collections.Set<string>();
		AdministrativeUsers = new Collections.Set<string>();

		static deserialize(json: any, privileges?: Privileges) {
			privileges = privileges || new Privileges();
			new List(["DownloadableRoles", "DownloadableUsers", "ViewableRoles", "ViewableUsers", "ContributiveRoles", "ContributiveUsers", "EditableRoles", "EditableUsers", "ModerateRoles", "ModerateUsers", "AdministrativeRoles", "AdministrativeUsers"])
				.ForEach(attribute => {
					if (json[attribute] && AppUtility.isArray(json[attribute])) {
						new List<string>(json[attribute]).ForEach(d => (privileges[attribute] as Collections.Set<string>).add(d));
					}
				}
			);
			return privileges;
		}
	}

	/** Contact information */
	export class ContactInfo {
		Name = "";
		Title = "";
		Phone = "";
		Email = "";
		Address = "";
		County = "";
		Province = "";
		Country = "";
		PostalCode = "";
		Notes = "";
		GPSLocation = "";

		static deserialize(json: any, contact?: ContactInfo) {
			contact = contact || new ContactInfo();
			AppUtility.copy(json, contact);
			return contact;
		}
	}

	/** Rating information */
	export class RatingPoint {
		Type = "";
		Total = 0;
		Points = 0.0;
		Average = 0.0;

		static deserialize(json: any, rating?: RatingPoint) {
			rating = rating || new RatingPoint();
			AppUtility.copy(json, rating);
			return rating;
		}
	}

	/** Based-Counter information */
	export class CounterBase {
		Type = "";
		Total = 0;

		constructor(type?: string, total?: number) {
			if (AppUtility.isNotEmpty(type) && total != undefined) {
				this.Type = type;
				this.Total = total;
			}
		}

		static deserialize(json: any, counter?: CounterBase) {
			counter = counter || new CounterBase();
			AppUtility.copy(json, counter);
			return counter;
		}
	}

	/** Counter information */
	export class CounterInfo extends CounterBase {
		LastUpdated = new Date();
		Month = 0;
		Week = 0;

		static deserialize(json: any, counter?: CounterInfo) {
			counter = counter || new CounterInfo();
			AppUtility.copy(json, counter);
			return counter;
		}
	}

	/** Based-Statistic information */
	export class StatisticBase {
		Name = "";
		Title = "";
		Counters = 0;

		static deserialize(json: any, statistic?: StatisticBase) {
			statistic = statistic || new StatisticBase();
			AppUtility.copy(json, statistic, (data: any) => {
				statistic.Title = AppUtility.toANSI(statistic.Name).toLowerCase();
			});
			return statistic;
		}
	}

	/** Statistic information */
	export class StatisticInfo extends StatisticBase {
		FullName = "";
		Children: Array<StatisticInfo> = [];

		static deserialize(json: any, statistic?: StatisticInfo) {
			statistic = statistic || new StatisticInfo();
			AppUtility.copy(json, statistic, (data: any) => {
				statistic.FullName = statistic.Name;
				statistic.Title = AppUtility.toANSI(statistic.FullName).toLowerCase();
				statistic.Children = !AppUtility.isArray(data.Children)
					? []
					: new List<any>(data.Children)
						.Select(c => {
							let child = new StatisticInfo();
							AppUtility.copy(c, child);
							child.FullName = statistic.Name + " > " + child.Name;
							child.Title = AppUtility.toANSI(child.FullName).toLowerCase();
							return child;
						})
						.ToArray();
			});
			return statistic;
		}

		toJSON() {
			let json = {
				Name: this.Name,
				Counters: this.Counters,
				Children: []
			};

			json.Children = new List(this.Children)
				.Select(c => {
					return { Name: c.Name, Counters: c.Counters }
				})
				.ToArray();

			return JSON.stringify(json);
		}
	}

	/** All available statistics */
	export class Statistics {
		Categories = new Array<StatisticInfo>();
		Authors = new Collections.Dictionary<string, Array<StatisticBase>>();
		Status = new Array<StatisticBase>();
	}
	
}